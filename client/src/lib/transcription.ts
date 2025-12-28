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
}

export type TranscriptionProgress = {
  status: 'loading' | 'processing' | 'complete' | 'error'
  progress: number // 0-100
  message?: string
}

// Web Worker instance (singleton)
let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    console.log('[Transcription] Creating Web Worker for transformers.js')
    const workerUrl = new URL('../workers/transcription.worker.ts', import.meta.url)
    console.log('[Transcription] Worker URL:', workerUrl.href)
    worker = new Worker(workerUrl, { type: 'module' })
    console.log('[Transcription] Web Worker created successfully')
  }
  return worker
}

// Main transcription function using Web Worker
export async function transcribeAudio(
  task: TranscriptionTask,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  
  console.log('Starting transcription with model:', task.modelName)
  console.log('[Transcription] Using Web Worker approach')
  
  return new Promise(async (resolve, reject) => {
    try {
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

      // Set up message handler
      const handleMessage = (event: MessageEvent) => {
        const { status, file, progress, result, error } = event.data

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

          case 'progress':
            const percent = progress || 0
            console.log(`Download progress for ${file}: ${percent.toFixed(1)}%`)
            onProgress?.({
              status: 'loading',
              progress: 25 + (percent * 0.25), // 25-50%
              message: `Downloading ${file}... ${percent.toFixed(1)}%`,
            })
            break

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

          case 'complete':
            console.log('Transcription complete!', result)
            transcriptionWorker.removeEventListener('message', handleMessage)
            
            // Format the result
            const text = result.text || ''
            const segments: TranscriptionSegment[] = []
            
            if (result.chunks && Array.isArray(result.chunks)) {
              for (const chunk of result.chunks) {
                segments.push({
                  start: chunk.timestamp[0] || 0,
                  end: chunk.timestamp[1] || 0,
                  text: chunk.text,
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
            })
            break

          case 'error':
            console.error('Worker error:', error)
            transcriptionWorker.removeEventListener('message', handleMessage)
            
            onProgress?.({
              status: 'error',
              progress: 0,
              message: `Transcription failed: ${error}`,
            })
            
            reject(new Error(error))
            break
        }
      }

      // Add event listener
      transcriptionWorker.addEventListener('message', handleMessage)

      // Send transcription request to worker
      transcriptionWorker.postMessage({
        type: 'transcribe',
        audioData,
        modelName: task.modelName,
        language: task.language,
      })

    } catch (error) {
      console.error('=== TRANSCRIPTION ERROR ===')
      console.error('Error:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      onProgress?.({
        status: 'error',
        progress: 0,
        message: `Transcription failed: ${errorMessage}`,
      })
      reject(error)
    }
  })
}

export async function isTranscriptionReady(_modelName: string): Promise<boolean> {
  // Models are downloaded on-demand, so always return true
  return true
}
