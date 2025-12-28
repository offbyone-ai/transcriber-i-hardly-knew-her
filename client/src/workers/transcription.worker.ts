// Web Worker for running Whisper transcription with transformers.js
// This avoids blocking the main thread and properly handles WASM initialization

// Types only - no runtime import
type AutomaticSpeechRecognitionPipeline = any

// Singleton pattern to ensure model is only loaded once
class WhisperPipeline {
  static instance: AutomaticSpeechRecognitionPipeline | null = null
  static modelName: string = 'Xenova/whisper-base.en'

  static async getInstance(
    modelName: string,
    progressCallback?: (progress: any) => void
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    // If model changed, reset instance
    if (this.modelName !== modelName) {
      this.instance = null
      this.modelName = modelName
    }

    // Load pipeline if not already loaded
    if (!this.instance) {
      // Dynamic import to avoid loading transformers.js until needed
      console.log('[Worker] Dynamically importing transformers.js...')
      const { pipeline, env } = await import('@huggingface/transformers')
      console.log('[Worker] Transformers.js imported successfully')
      
      // Configure environment BEFORE creating pipeline
      env.allowLocalModels = false
      env.allowRemoteModels = true
      env.useBrowserCache = true
      
      // Let transformers.js use its default WASM paths (auto-configured)
      // Don't override the backends - let it figure out the right version
      
      console.log('[Worker] Environment configured:', {
        allowRemoteModels: env.allowRemoteModels,
        useBrowserCache: env.useBrowserCache
      })
      
      console.log('[Worker] Creating pipeline for model:', modelName)
      this.instance = await pipeline(
        'automatic-speech-recognition',
        modelName,
        { progress_callback: progressCallback }
      ) as AutomaticSpeechRecognitionPipeline
      
      console.log('[Worker] Pipeline created successfully')
    }

    return this.instance
  }
}

// Map model names to Hugging Face model IDs
function getModelId(modelName: string): string {
  const modelMap: Record<string, string> = {
    'tiny': 'Xenova/whisper-tiny',
    'tiny.en': 'Xenova/whisper-tiny.en',
    'base': 'Xenova/whisper-base',
    'base.en': 'Xenova/whisper-base.en',
    'small': 'Xenova/whisper-small',
    'small.en': 'Xenova/whisper-small.en',
  }
  return modelMap[modelName] || 'Xenova/whisper-base.en'
}

// Message types from main thread
interface TranscribeMessage {
  type: 'transcribe'
  audioData: Float32Array
  modelName: string
  language?: string
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data as TranscribeMessage

  if (message.type === 'transcribe') {
    try {
      console.log('[Worker] Received transcription request for model:', message.modelName)
      
      // Get the transcription pipeline
      const modelId = getModelId(message.modelName)
      console.log('[Worker] Mapped to model ID:', modelId)
      
      const transcriber = await WhisperPipeline.getInstance(
        modelId,
        (progress) => {
          // Send progress updates back to main thread
          console.log('[Worker] Progress:', progress.status, progress.file, progress.progress)
          self.postMessage({
            status: progress.status,
            file: progress.file,
            progress: progress.progress,
            loaded: progress.loaded,
            total: progress.total,
          })
        }
      )

      // Send ready signal
      self.postMessage({ status: 'ready' })

      // Perform transcription
      const result = await transcriber(message.audioData, {
        language: message.language,
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
      })

      // Send result back to main thread
      // Handle both single and array results
      const output = Array.isArray(result) ? result[0] : result
      self.postMessage({
        status: 'complete',
        result: {
          text: output.text,
          chunks: output.chunks,
        },
      })
    } catch (error) {
      // Send error back to main thread with full details
      console.error('[Worker] Transcription error:', error)
      console.error('[Worker] Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('[Worker] Error stack:', error instanceof Error ? error.stack : 'No stack')
      
      self.postMessage({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
})

// Signal that worker is initialized
self.postMessage({ status: 'initialized' })
