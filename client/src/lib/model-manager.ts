import { WHISPER_MODELS, type WhisperModel, type WhisperModelInfo } from '@shared/types'
import { saveModel, getModel, getDownloadedModels } from './db'

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
