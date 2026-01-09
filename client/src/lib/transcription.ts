// Transcription using transformers.js in a Web Worker for proper WASM handling
import type { TranscriptionSegment } from '@shared/types'
import { convertAudioForWhisper } from './audio-processing'

export type TranscriptionTask = {
  audioBlob: Blob
  modelName: string
  language?: string
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  language: string
  processingTimeMs: number
}

export type TranscriptionProgress = {
  status: 'loading' | 'processing' | 'complete' | 'error'
  progress: number // 0-100
  message?: string
}

// Web Worker instance (singleton)
let worker: Worker | null = null
let workerFailed = false

function getWorker(): Worker {
  if (workerFailed) {
    throw new Error('Web Worker failed to initialize. Please refresh the page and try again.')
  }
  
  if (!worker) {
    try {
      console.log('[Transcription] Creating Web Worker for transformers.js')
      // Import worker directly - Vite will handle bundling
      worker = new Worker(new URL('../workers/transcription.worker.js', import.meta.url), { 
        type: 'module' 
      })
      console.log('[Transcription] Worker URL:', worker)
      
      // Add global error handler for worker
      worker.onerror = (error) => {
        console.error('[Transcription] Worker error event:', error)
        console.error('[Transcription] Error message:', error.message)
        console.error('[Transcription] Error filename:', error.filename)
        console.error('[Transcription] Error lineno:', error.lineno)
        
        // Mark worker as failed to prevent retry loops
        workerFailed = true
        worker = null
      }
      
      console.log('[Transcription] Web Worker created successfully')
    } catch (error) {
      console.error('[Transcription] Failed to create Web Worker:', error)
      workerFailed = true
      throw new Error('Failed to initialize transcription. Your browser may not support Web Workers or WASM.')
    }
  }
  return worker
}

// Main transcription function using Web Worker
export async function transcribeAudio(
  task: TranscriptionTask,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  
  const startTime = performance.now() // Start timing
  
  console.log('Starting transcription with model:', task.modelName)
  console.log('[Transcription] Using Web Worker approach')
  
  onProgress?.({
    status: 'loading',
    progress: 10,
    message: 'Converting audio format...',
  })

  // Convert audio to format expected by Whisper
  const audioData = await convertAudioForWhisper(task.audioBlob)
  console.log('Audio converted, samples:', audioData.length)

  onProgress?.({
    status: 'loading',
    progress: 20,
    message: 'Loading Whisper model (first run may take 1-2 minutes)...',
  })

  // Get the worker
  const transcriptionWorker = getWorker()
  console.log('[Transcription] Got worker instance:', transcriptionWorker)

  return new Promise((resolve, reject) => {
    // Set up timeout to catch worker failures
    let hasReceivedMessage = false
    const workerTimeout = setTimeout(() => {
      if (!hasReceivedMessage) {
        console.error('[Transcription] Worker timeout - no response received')
        transcriptionWorker.removeEventListener('message', handleMessage)

        onProgress?.({
          status: 'error',
          progress: 0,
          message: 'Worker failed to respond. Please refresh and try again.',
        })

        reject(new Error('Worker failed to initialize. The worker may have crashed during startup.'))
      }
    }, 10000) // 10 second timeout

    // Set up message handler
    const handleMessage = (event: MessageEvent) => {
      hasReceivedMessage = true
      clearTimeout(workerTimeout)

      const { status, file, progress, result, error, details } = event.data

      switch (status) {
        case 'initialized':
          console.log('Worker initialized')
          break

        case 'initiate':
          console.log('Starting to download:', file)
          onProgress?.({
            status: 'loading',
            progress: 25,
            message: `Downloading ${file}...`,
          })
          break

        case 'progress': {
          const percent = progress || 0
          console.log(`Download progress for ${file}: ${percent.toFixed(1)}%`)
          onProgress?.({
            status: 'loading',
            progress: 25 + (percent * 0.25), // 25-50%
            message: `Downloading ${file}... ${percent.toFixed(1)}%`,
          })
          break
        }

        case 'done':
          console.log('Downloaded:', file)
          break

        case 'ready':
          console.log('Model ready, starting transcription...')
          onProgress?.({
            status: 'processing',
            progress: 60,
            message: 'Transcribing audio...',
          })
          break

        case 'complete': {
          console.log('Transcription complete!', result)
          clearTimeout(workerTimeout)
          transcriptionWorker.removeEventListener('message', handleMessage)

          const endTime = performance.now()
          const processingTimeMs = Math.round(endTime - startTime)

          // Format the result
          const text = result.text || ''
          const segments: TranscriptionSegment[] = []

          if (result.chunks && Array.isArray(result.chunks)) {
            for (const chunk of result.chunks) {
              segments.push({
                start: chunk.timestamp[0] || 0,
                end: chunk.timestamp[1] || 0,
                text: chunk.text.trim(),
              })
            }
          }

          onProgress?.({
            status: 'complete',
            progress: 100,
            message: 'Transcription complete!',
          })

          resolve({
            text,
            segments,
            language: task.language || 'en',
            processingTimeMs,
          })
          break
        }

        case 'error': {
          console.error('Worker error:', error)
          if (details) {
            console.error('Error details:', details)
          }
          clearTimeout(workerTimeout)
          transcriptionWorker.removeEventListener('message', handleMessage)

          const errorMsg = error || 'Unknown worker error'
          onProgress?.({
            status: 'error',
            progress: 0,
            message: `Failed: ${errorMsg}`,
          })

          reject(new Error(errorMsg))
          break
        }
      }
    }

    // Add event listener
    transcriptionWorker.addEventListener('message', handleMessage)

    // Send transcription request to worker
    console.log('[Transcription] Posting message to worker with audio data length:', audioData.length)
    transcriptionWorker.postMessage({
      type: 'transcribe',
      audioData,
      modelName: task.modelName,
      language: task.language,
    })
    console.log('[Transcription] Message posted to worker successfully')
  })
}

/**
 * Transcribe raw PCM audio samples directly (for live transcription)
 * This bypasses the audio decoding step since we already have raw samples.
 */
export async function transcribePCM(
  audioData: Float32Array,
  modelName: string,
  language?: string,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  const startTime = performance.now()
  
  console.log('[Transcription] Transcribing PCM audio, samples:', audioData.length)
  
  return new Promise((resolve, reject) => {
    try {
      onProgress?.({
        status: 'loading',
        progress: 20,
        message: 'Loading Whisper model...',
      })

      const transcriptionWorker = getWorker()

      let hasReceivedMessage = false
      const workerTimeout = setTimeout(() => {
        if (!hasReceivedMessage) {
          console.error('[Transcription] Worker timeout - no response received')
          transcriptionWorker.removeEventListener('message', handleMessage)
          reject(new Error('Worker failed to respond'))
        }
      }, 30000) // 30 second timeout for longer audio

      const handleMessage = (event: MessageEvent) => {
        hasReceivedMessage = true
        
        const { status, file, progress, result, error } = event.data

        switch (status) {
          case 'progress': {
            const percent = progress || 0
            onProgress?.({
              status: 'loading',
              progress: 20 + (percent * 0.3),
              message: `Downloading ${file}... ${percent.toFixed(1)}%`,
            })
            break
          }

          case 'ready':
            onProgress?.({
              status: 'processing',
              progress: 60,
              message: 'Transcribing audio...',
            })
            break

          case 'complete': {
            clearTimeout(workerTimeout)
            transcriptionWorker.removeEventListener('message', handleMessage)

            const endTime = performance.now()
            const processingTimeMs = Math.round(endTime - startTime)

            const text = result.text || ''
            const segments: TranscriptionSegment[] = []

            if (result.chunks && Array.isArray(result.chunks)) {
              for (const chunk of result.chunks) {
                segments.push({
                  start: chunk.timestamp[0] || 0,
                  end: chunk.timestamp[1] || 0,
                  text: chunk.text.trim(),
                })
              }
            }

            onProgress?.({
              status: 'complete',
              progress: 100,
              message: 'Transcription complete!',
            })

            resolve({
              text,
              segments,
              language: language || 'en',
              processingTimeMs,
            })
            break
          }

          case 'error':
            clearTimeout(workerTimeout)
            transcriptionWorker.removeEventListener('message', handleMessage)
            reject(new Error(error || 'Unknown worker error'))
            break
        }
      }

      transcriptionWorker.addEventListener('message', handleMessage)

      console.log('[Transcription] Posting PCM audio to worker, samples:', audioData.length)
      transcriptionWorker.postMessage({
        type: 'transcribe',
        audioData,
        modelName,
        language,
      })

    } catch (error) {
      console.error('[Transcription] PCM transcription error:', error)
      reject(error)
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function isTranscriptionReady(_modelName: string): Promise<boolean> {
  // Models are downloaded on-demand, so always return true
  return true
}

// Real-time transcription with chunking
export type RealtimeTranscriptionChunk = {
  text: string
  timestamp: number // when this chunk started (seconds from recording start)
  segments: TranscriptionSegment[]
}

export type RealtimeTranscriptionCallback = (chunk: RealtimeTranscriptionChunk) => void

export class RealtimeTranscriber {
  private audioChunks: Blob[] = []
  private startTime: number = 0
  private chunkStartTime: number = 0
  private isTranscribing: boolean = false
  private modelName: string
  private language?: string
  private onChunkComplete?: RealtimeTranscriptionCallback
  private processingPromise: Promise<void> | null = null
  
  constructor(
    modelName: string,
    language?: string,
    onChunkComplete?: RealtimeTranscriptionCallback
  ) {
    this.modelName = modelName
    this.language = language
    this.onChunkComplete = onChunkComplete
  }
  
  start() {
    console.log('[RealtimeTranscriber] Starting real-time transcription')
    this.startTime = Date.now()
    this.chunkStartTime = this.startTime
    this.audioChunks = []
    this.isTranscribing = true
    console.log('[RealtimeTranscriber] Started, startTime:', this.startTime)
  }
  
  addAudioData(blob: Blob) {
    if (!this.isTranscribing) {
      console.log('[RealtimeTranscriber] Not transcribing, ignoring audio data')
      return
    }
    console.log('[RealtimeTranscriber] Adding audio chunk, size:', blob.size, 'total chunks:', this.audioChunks.length + 1)
    this.audioChunks.push(blob)
  }
  
  async processCurrentChunk(): Promise<void> {
    console.log('[RealtimeTranscriber] processCurrentChunk called, isTranscribing:', this.isTranscribing, 'chunks:', this.audioChunks.length)
    
    if (!this.isTranscribing || this.audioChunks.length === 0) {
      console.log('[RealtimeTranscriber] Skipping - not transcribing or no chunks')
      return
    }
    
    // Require at least 3 chunks (9 seconds) before processing
    // This ensures we have enough audio data for reliable decoding
    if (this.audioChunks.length < 3) {
      console.log('[RealtimeTranscriber] Skipping - need at least 3 chunks, have', this.audioChunks.length)
      return
    }
    
    // Wait for any in-progress processing
    if (this.processingPromise) {
      console.log('[RealtimeTranscriber] Waiting for in-progress processing...')
      await this.processingPromise
    }
    
    // Create a promise for this processing task
    console.log('[RealtimeTranscriber] Starting to process', this.audioChunks.length, 'chunks')
    this.processingPromise = this._doProcessChunk()
    await this.processingPromise
    this.processingPromise = null
  }
  
  private async _doProcessChunk(): Promise<void> {
    const chunksToProcess = [...this.audioChunks]
    const chunkStartSeconds = (this.chunkStartTime - this.startTime) / 1000
    
    console.log('[RealtimeTranscriber] _doProcessChunk: Processing', chunksToProcess.length, 'chunks starting at', chunkStartSeconds, 's')
    
    // Reset for next chunk
    this.audioChunks = []
    this.chunkStartTime = Date.now()
    
    if (chunksToProcess.length === 0) {
      console.log('[RealtimeTranscriber] No chunks to process')
      return
    }
    
    try {
      // Combine all chunks into one blob
      // Note: This creates a concatenated blob, but WebM chunks from MediaRecorder
      // with short timeslices may not decode properly when concatenated
      const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' })
      console.log('[RealtimeTranscriber] Created audio blob, size:', audioBlob.size, 'bytes')
      
      // Check if blob is too small (likely incomplete audio)
      if (audioBlob.size < 1000) {
        console.log('[RealtimeTranscriber] Blob too small, skipping transcription')
        return
      }
      
      // Transcribe the chunk
      console.log('[RealtimeTranscriber] Starting transcription with model:', this.modelName)
      const result = await transcribeAudio(
        {
          audioBlob,
          modelName: this.modelName,
          language: this.language,
        },
        undefined // No progress callback for real-time chunks
      )
      
      console.log('[RealtimeTranscriber] Transcription complete, text:', result.text)
      
      // Call the callback with the result
      if (this.onChunkComplete) {
        console.log('[RealtimeTranscriber] Calling onChunkComplete callback')
        this.onChunkComplete({
          text: result.text,
          timestamp: chunkStartSeconds,
          segments: result.segments.map(seg => ({
            ...seg,
            start: seg.start + chunkStartSeconds,
            end: seg.end + chunkStartSeconds,
          })),
        })
      } else {
        console.log('[RealtimeTranscriber] No callback registered!')
      }
    } catch (error) {
      console.error('[RealtimeTranscriber] Error processing real-time chunk:', error)
    }
  }
  
  stop() {
    this.isTranscribing = false
  }
  
  async finish(): Promise<void> {
    this.isTranscribing = false
    
    // Process any remaining audio
    if (this.audioChunks.length > 0) {
      await this.processCurrentChunk()
    }
    
    // Wait for any in-progress processing
    if (this.processingPromise) {
      await this.processingPromise
    }
  }
}

