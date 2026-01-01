// Web Worker for running Whisper transcription with transformers.js
// This avoids blocking the main thread and properly handles WASM initialization

// Global error handler for uncaught errors in worker
self.addEventListener('error', (event) => {
  console.error('[Worker] Uncaught error:', event.error)
  console.error('[Worker] Error message:', event.message)
  console.error('[Worker] Error filename:', event.filename)
  console.error('[Worker] Error lineno:', event.lineno)
  console.error('[Worker] Error colno:', event.colno)
  
  // Send error to main thread
  self.postMessage({
    status: 'error',
    error: event.error instanceof Error ? event.error.message : String(event.message),
    details: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }
  })
})

// Global handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Worker] Unhandled promise rejection:', event.reason)
  
  // Send error to main thread
  self.postMessage({
    status: 'error',
    error: event.reason instanceof Error ? event.reason.message : String(event.reason),
  })
})

/**
 * Singleton pattern to ensure model is only loaded once
 */
class WhisperPipeline {
  /** @type {any | null} */
  static instance = null
  /** @type {string} */
  static modelName = 'Xenova/whisper-base.en'

  /**
   * Get or create the transcription pipeline instance
   * @param {string} modelName - The model to load
   * @param {Function} [progressCallback] - Optional progress callback
   * @returns {Promise<any>}
   */
  static async getInstance(modelName, progressCallback) {
    // If model changed, reset instance
    if (this.modelName !== modelName) {
      this.instance = null
      this.modelName = modelName
    }

    // Load pipeline if not already loaded
    if (!this.instance) {
      try {
        // Import from CDN to avoid bundling transformers.js
        // Using the ESM CDN version that works in Web Workers
        console.log('[Worker] Dynamically importing transformers.js from CDN...')
        const transformersUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
        const { pipeline, env } = await import(/* @vite-ignore */ transformersUrl)
        console.log('[Worker] Transformers.js imported successfully')
      
        // Configure environment BEFORE creating pipeline
        env.allowLocalModels = false
        env.allowRemoteModels = true
        env.useBrowserCache = true
        
        // Try to use WebGPU if available for better performance
        // This is especially helpful on mobile devices and modern GPUs
        if (typeof navigator !== 'undefined' && navigator.gpu) {
          console.log('[Worker] WebGPU is available! Attempting to use it...')
          try {
            const adapter = await navigator.gpu.requestAdapter()
            if (adapter) {
              console.log('[Worker] WebGPU adapter found, enabling WebGPU backend')
              env.backends = {
                onnx: {
                  wasm: { 
                    numThreads: 4 
                  },
                  // Prefer WebGPU when available
                  webgpu: {}
                }
              }
            } else {
              console.log('[Worker] WebGPU adapter not found, falling back to WASM')
            }
          } catch (gpuError) {
            console.log('[Worker] WebGPU check failed, using WASM:', gpuError)
          }
        } else {
          console.log('[Worker] WebGPU not available, using WASM backend')
        }
        
        console.log('[Worker] Environment configured:', {
          allowRemoteModels: env.allowRemoteModels,
          useBrowserCache: env.useBrowserCache
        })
        
        console.log('[Worker] Creating pipeline for model:', modelName)
        this.instance = await pipeline(
          'automatic-speech-recognition',
          modelName,
          { progress_callback: progressCallback }
        )
        
        console.log('[Worker] Pipeline created successfully')
      } catch (error) {
        console.error('[Worker] Failed to initialize pipeline:', error)
        console.error('[Worker] Error details:', error instanceof Error ? error.message : String(error))
        console.error('[Worker] Error stack:', error instanceof Error ? error.stack : 'No stack')
        throw error
      }
    }

    return this.instance
  }
}

/**
 * Map model names to Hugging Face model IDs
 * @param {string} modelName - Short model name
 * @returns {string} Full Hugging Face model ID
 */
function getModelId(modelName) {
  const modelMap = {
    'tiny': 'Xenova/whisper-tiny',
    'tiny.en': 'Xenova/whisper-tiny.en',
    'base': 'Xenova/whisper-base',
    'base.en': 'Xenova/whisper-base.en',
    'small': 'Xenova/whisper-small',
    'small.en': 'Xenova/whisper-small.en',
  }
  return modelMap[modelName] || 'Xenova/whisper-base.en'
}

// Listen for messages from main thread
self.addEventListener('message', async (event) => {
  const message = event.data

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
      // Note: English-only models (.en) don't accept language parameter
      const isEnglishOnly = modelId.includes('.en')
      const transcriptionOptions = {
        return_timestamps: true, // Use segment-level timestamps (sentences/phrases) instead of word-level
        chunk_length_s: 30,
        stride_length_s: 5,
      }
      
      // Only add language parameter for multilingual models
      if (!isEnglishOnly && message.language) {
        transcriptionOptions.language = message.language
      }
      
      console.log('[Worker] Transcription options:', transcriptionOptions)
      
      const result = await transcriber(message.audioData, transcriptionOptions)

      // Send result back to main thread
      // Handle both single and array results
      const output = Array.isArray(result) ? result[0] : result
      self.postMessage({
        status: 'complete',
        result: {
          text: output.text.trim(),
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
