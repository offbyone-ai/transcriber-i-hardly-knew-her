import type { TranscriptionSegment } from '@shared/types'

// Use the same base URL as auth client
const API_BASE_URL = import.meta.env.VITE_SERVER_URL || ''

export type UsageInfo = {
  used: number
  limit: number
  remaining: number
  resetsAt: string
  isPremium: boolean
}

export type ServerTranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  language: string
  processingTimeMs: number
  modelUsed: string
}

export type ServerTranscriptionResponse = {
  success: boolean
  transcription: ServerTranscriptionResult
  usage: UsageInfo
  privacy: {
    audioStored: boolean
    transcriptionStored: boolean
    message: string
  }
}

export type ServerTranscriptionProgress = {
  status: 'uploading' | 'processing' | 'complete' | 'error'
  progress: number
  message?: string
}

export type TranscriptionStatusResponse = {
  ready: boolean
  models: string[]
  defaultModel: string
  usage: UsageInfo
  freeTierLimit: number
}

/**
 * Check if server-side transcription is available and get usage info
 */
export async function getServerTranscriptionStatus(): Promise<TranscriptionStatusResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transcription/status`, {
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Check if server-side transcription is available
 */
export async function isServerTranscriptionAvailable(): Promise<boolean> {
  const status = await getServerTranscriptionStatus()
  return status?.ready ?? false
}

/**
 * Get current usage info
 */
export async function getServerUsage(): Promise<UsageInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transcription/usage`, {
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.usage
  } catch {
    return null
  }
}

/**
 * Transcribe audio using the server
 */
export async function transcribeOnServer(
  audioBlob: Blob,
  options: {
    modelName?: string
    language?: string
    duration?: number
    onProgress?: (progress: ServerTranscriptionProgress) => void
  } = {}
): Promise<ServerTranscriptionResponse> {
  const { modelName = 'base.en', language, duration, onProgress } = options
  
  onProgress?.({
    status: 'uploading',
    progress: 10,
    message: 'Uploading audio to server...',
  })
  
  // Create form data
  const formData = new FormData()
  formData.append('audio', audioBlob, 'audio.webm')
  formData.append('model', modelName)
  if (language) {
    formData.append('language', language)
  }
  if (duration) {
    formData.append('duration', duration.toString())
  }
  
  onProgress?.({
    status: 'processing',
    progress: 30,
    message: 'Server is transcribing audio...',
  })
  
  const response = await fetch(`${API_BASE_URL}/api/transcription/transcribe`, {
    method: 'POST',
    body: formData,
    credentials: 'include', // Include auth cookies
  })
  
  if (!response.ok) {
    let errorMessage = 'Server transcription failed'
    
    // Try to parse JSON error, fall back to text
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json()
        errorMessage = error.message || error.error || errorMessage
      } else {
        const text = await response.text()
        errorMessage = text || errorMessage
      }
    } catch {
      // If parsing fails, use default message
    }
    
    // Handle rate limit error specially
    if (response.status === 429) {
      onProgress?.({
        status: 'error',
        progress: 0,
        message: errorMessage || 'Monthly limit reached',
      })
      throw new Error(errorMessage || 'Monthly server transcription limit reached')
    }
    
    throw new Error(errorMessage)
  }
  
  const data = await response.json()
  
  onProgress?.({
    status: 'complete',
    progress: 100,
    message: 'Transcription complete!',
  })
  
  return data
}
