import { WHISPER_MODELS, type WhisperModel, type WhisperModelInfo } from '@shared/types'
import { saveModel, getModel, getDownloadedModels } from './db'
import { isMobileDevice, getDeviceMemoryGB } from './device-detection'

export type DownloadProgress = {
  loaded: number
  total: number
  percentage: number
}

export async function downloadModel(
  modelName: WhisperModel,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const modelInfo = WHISPER_MODELS[modelName]
  
  if (!modelInfo) {
    throw new Error(`Unknown model: ${modelName}`)
  }

  try {
    const response = await fetch(modelInfo.url)
    
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : modelInfo.size

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      loaded += value.length

      if (onProgress) {
        onProgress({
          loaded,
          total,
          percentage: (loaded / total) * 100,
        })
      }
    }

    // Combine chunks into single ArrayBuffer
    const buffer = new Uint8Array(loaded)
    let position = 0
    for (const chunk of chunks) {
      buffer.set(chunk, position)
      position += chunk.length
    }

    // Save to IndexedDB
    await saveModel(modelName, buffer.buffer)
  } catch (error) {
    console.error('Model download failed:', error)
    throw error
  }
}

export async function isModelDownloaded(modelName: WhisperModel): Promise<boolean> {
  const model = await getModel(modelName)
  return !!model
}

export async function getModelsList(): Promise<WhisperModelInfo[]> {
  return Object.values(WHISPER_MODELS)
}

export async function getDownloadedModelsList(): Promise<WhisperModel[]> {
  const models = await getDownloadedModels()
  return models.map(m => m.name)
}

// Get/set preferred model in localStorage
export function getPreferredModel(): WhisperModel {
  const saved = localStorage.getItem('preferred-whisper-model')
  return (saved as WhisperModel) || 'base.en'
}

export function setPreferredModel(modelName: WhisperModel) {
  localStorage.setItem('preferred-whisper-model', modelName)
}

/**
 * Get recommended model based on device capabilities
 * Returns smaller models for mobile/low-memory devices
 */
export function getRecommendedModel(): WhisperModel {
  const memory = getDeviceMemoryGB()
  const isMobile = isMobileDevice()

  // Mobile devices: recommend tiny or base
  if (isMobile) {
    if (memory >= 8) {
      return 'base.en'  // 150MB, good quality
    }
    return 'tiny.en'     // 75MB, fastest but lower quality
  }

  // Desktop with low memory (< 4GB)
  if (memory < 4) {
    return 'tiny.en'
  }

  // Desktop with medium memory (4-8GB)
  if (memory < 8) {
    return 'base.en'
  }

  // Desktop with high memory (8GB+)
  return 'small.en'      // 500MB, best quality
}

/**
 * Check if a model is appropriate for the current device
 */
export function isModelAppropriateForDevice(modelName: WhisperModel): {
  appropriate: boolean
  warning?: string
} {
  const memory = getDeviceMemoryGB()
  const isMobile = isMobileDevice()
  const modelInfo = WHISPER_MODELS[modelName]

  if (!modelInfo) {
    return { appropriate: false, warning: 'Unknown model' }
  }

  // Get model size in GB (approximate)
  const modelSizeGB = modelInfo.size / (1024 * 1024 * 1024)

  // Check if model would use too much memory
  const memoryUsageRatio = modelSizeGB / memory

  if (isMobile) {
    if (memoryUsageRatio > 0.1) {
      return {
        appropriate: false,
        warning: 'This model may cause your mobile browser to crash due to memory constraints.'
      }
    }
    if (memoryUsageRatio > 0.05) {
      return {
        appropriate: true,
        warning: 'This model may be slow on your mobile device.'
      }
    }
  } else {
    // Desktop
    if (memoryUsageRatio > 0.3) {
      return {
        appropriate: false,
        warning: 'Your device may not have enough memory for this model.'
      }
    }
    if (memoryUsageRatio > 0.15) {
      return {
        appropriate: true,
        warning: 'This model may be slow on your device.'
      }
    }
  }

  return { appropriate: true }
}

/**
 * Get model size category for UI display
 */
export type ModelSizeCategory = 'tiny' | 'small' | 'medium' | 'large'

export function getModelSizeCategory(modelName: WhisperModel): ModelSizeCategory {
  const modelInfo = WHISPER_MODELS[modelName]
  if (!modelInfo) return 'small'

  const sizeMB = modelInfo.size / (1024 * 1024)

  if (sizeMB < 100) return 'tiny'
  if (sizeMB < 250) return 'small'
  if (sizeMB < 750) return 'medium'
  return 'large'
}
