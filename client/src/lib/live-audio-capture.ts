/**
 * Live Audio Capture for Real-time Transcription
 * 
 * Uses Web Audio API to capture raw PCM audio samples in parallel with MediaRecorder.
 * This bypasses the WebM encoding/decoding issues that prevent chunk-based transcription.
 */

export type LiveAudioChunk = {
  samples: Float32Array
  startTime: number // seconds from recording start
  endTime: number   // seconds from recording start
}

export type LiveAudioCaptureOptions = {
  sampleRate?: number      // Target sample rate (default: 16000 for Whisper)
  chunkDuration?: number   // Duration of each chunk in seconds (default: 10)
  onChunkReady?: (chunk: LiveAudioChunk) => void
}

export class LiveAudioCapture {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  // Using ScriptProcessorNode (deprecated but widely supported)
  // AudioWorklet would be preferred but requires more complex setup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processorNode: any = null
  
  private sampleRate: number
  private chunkDuration: number
  private onChunkReady?: (chunk: LiveAudioChunk) => void
  
  private isCapturing: boolean = false
  private recordingStartTime: number = 0
  private currentChunkStartTime: number = 0
  private audioBuffer: Float32Array[] = []
  private totalSamplesInBuffer: number = 0
  
  constructor(options: LiveAudioCaptureOptions = {}) {
    this.sampleRate = options.sampleRate || 16000
    this.chunkDuration = options.chunkDuration || 10
    this.onChunkReady = options.onChunkReady
  }
  
  /**
   * Start capturing audio from the stream
   */
  async start(stream: MediaStream): Promise<void> {
    console.log('[LiveAudioCapture] Starting audio capture')
    
    // Create audio context with our target sample rate
    // Note: Browser will resample automatically
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
    
    // Create source from the media stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream)
    
    // Create a script processor for capturing samples
    // Using 4096 buffer size for good balance between latency and efficiency
    const bufferSize = 4096
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)
    
    // Process audio samples
    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isCapturing) return
      
      // Get the input audio data (mono)
      const inputData = event.inputBuffer.getChannelData(0)
      
      // Store a copy of the samples
      this.audioBuffer.push(new Float32Array(inputData))
      this.totalSamplesInBuffer += inputData.length
      
      // Check if we have enough samples for a chunk
      const samplesPerChunk = this.sampleRate * this.chunkDuration
      if (this.totalSamplesInBuffer >= samplesPerChunk) {
        this.emitChunk()
      }
    }
    
    // Connect the nodes
    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
    
    // Mark as capturing
    this.isCapturing = true
    this.recordingStartTime = performance.now() / 1000
    this.currentChunkStartTime = this.recordingStartTime
    this.audioBuffer = []
    this.totalSamplesInBuffer = 0
    
    console.log('[LiveAudioCapture] Started, sample rate:', this.audioContext.sampleRate)
  }
  
  /**
   * Emit the current audio buffer as a chunk
   */
  private emitChunk(): void {
    if (this.audioBuffer.length === 0) return
    
    // Combine all buffers into a single Float32Array
    const combinedSamples = new Float32Array(this.totalSamplesInBuffer)
    let offset = 0
    for (const buffer of this.audioBuffer) {
      combinedSamples.set(buffer, offset)
      offset += buffer.length
    }
    
    const endTime = performance.now() / 1000
    
    const chunk: LiveAudioChunk = {
      samples: combinedSamples,
      startTime: this.currentChunkStartTime - this.recordingStartTime,
      endTime: endTime - this.recordingStartTime,
    }
    
    console.log('[LiveAudioCapture] Emitting chunk:', {
      samples: chunk.samples.length,
      startTime: chunk.startTime.toFixed(2),
      endTime: chunk.endTime.toFixed(2),
      duration: (chunk.endTime - chunk.startTime).toFixed(2),
    })
    
    // Reset buffer for next chunk
    this.audioBuffer = []
    this.totalSamplesInBuffer = 0
    this.currentChunkStartTime = endTime
    
    // Call the callback
    if (this.onChunkReady) {
      this.onChunkReady(chunk)
    }
  }
  
  /**
   * Get the current buffer without clearing it
   * Useful for getting partial transcription updates
   */
  getCurrentBuffer(): Float32Array | null {
    if (this.audioBuffer.length === 0) return null
    
    const combinedSamples = new Float32Array(this.totalSamplesInBuffer)
    let offset = 0
    for (const buffer of this.audioBuffer) {
      combinedSamples.set(buffer, offset)
      offset += buffer.length
    }
    
    return combinedSamples
  }
  
  /**
   * Force emit the current buffer as a chunk (for final processing)
   */
  flush(): LiveAudioChunk | null {
    if (this.audioBuffer.length === 0 || this.totalSamplesInBuffer === 0) {
      return null
    }
    
    // Combine all buffers into a single Float32Array
    const combinedSamples = new Float32Array(this.totalSamplesInBuffer)
    let offset = 0
    for (const buffer of this.audioBuffer) {
      combinedSamples.set(buffer, offset)
      offset += buffer.length
    }
    
    const endTime = performance.now() / 1000
    
    const chunk: LiveAudioChunk = {
      samples: combinedSamples,
      startTime: this.currentChunkStartTime - this.recordingStartTime,
      endTime: endTime - this.recordingStartTime,
    }
    
    console.log('[LiveAudioCapture] Flushing final chunk:', {
      samples: chunk.samples.length,
      startTime: chunk.startTime.toFixed(2),
      endTime: chunk.endTime.toFixed(2),
      duration: (chunk.endTime - chunk.startTime).toFixed(2),
    })
    
    // Reset buffer
    this.audioBuffer = []
    this.totalSamplesInBuffer = 0
    
    return chunk
  }
  
  /**
   * Stop capturing audio
   */
  stop(): void {
    console.log('[LiveAudioCapture] Stopping audio capture')
    
    this.isCapturing = false
    
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
  
  /**
   * Check if currently capturing
   */
  get capturing(): boolean {
    return this.isCapturing
  }
}
