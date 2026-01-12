// Server-side transcription using OpenAI-compatible Whisper API
// Works with: OpenAI, Groq, local Whisper servers, etc.

export type ServerTranscriptionResult = {
  text: string
  segments: { start: number; end: number; text: string }[]
  language: string
  processingTimeMs: number
  modelUsed: string
}

export type TranscriptionOptions = {
  modelName?: string
  language?: string
}

// Default configuration - can be overridden via environment variables
const WHISPER_API_URL = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_API_KEY = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || ''
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1'

/**
 * Check if server transcription is enabled and configured
 */
export function isServerTranscriptionEnabled(): boolean {
  return !!WHISPER_API_KEY && WHISPER_API_KEY.length > 0
}

/**
 * Get available models for server transcription
 */
export function getAvailableModels(): string[] {
  // OpenAI's Whisper API only supports whisper-1
  // But other providers (Groq, local) may support more
  return ['whisper-1', 'whisper-large-v3', 'whisper-large-v3-turbo']
}

/**
 * Get default model for server transcription
 */
export function getDefaultModel(): string {
  return WHISPER_MODEL
}

/**
 * Transcribe audio using OpenAI-compatible Whisper API
 *
 * @param audioData - Raw PCM audio data (Float32Array at 16kHz mono)
 * @param options - Transcription options
 * @returns Transcription result
 */
export async function transcribeAudio(
  audioData: Float32Array,
  options: TranscriptionOptions = {}
): Promise<ServerTranscriptionResult> {
  if (!isServerTranscriptionEnabled()) {
    throw new Error('Server transcription is not configured. Set WHISPER_API_KEY environment variable.')
  }

  const startTime = performance.now()
  const modelName = options.modelName || WHISPER_MODEL

  // Convert Float32Array (PCM) to WAV format for the API
  const wavBlob = pcmToWav(audioData, 16000)

  // Create form data for the API request
  const formData = new FormData()
  formData.append('file', wavBlob, 'audio.wav')
  formData.append('model', modelName)

  if (options.language) {
    formData.append('language', options.language)
  }

  // Request verbose JSON to get segments with timestamps
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  console.log(`[Transcription] Sending to ${WHISPER_API_URL} with model ${modelName}`)

  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHISPER_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Transcription] API error:', response.status, errorText)
    throw new Error(`Transcription API error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const endTime = performance.now()

  // Parse the response (OpenAI format)
  const text = result.text || ''
  const segments: { start: number; end: number; text: string }[] = []

  if (result.segments && Array.isArray(result.segments)) {
    for (const seg of result.segments) {
      segments.push({
        start: seg.start || 0,
        end: seg.end || 0,
        text: (seg.text || '').trim(),
      })
    }
  }

  return {
    text,
    segments,
    language: result.language || options.language || 'en',
    processingTimeMs: Math.round(endTime - startTime),
    modelUsed: modelName,
  }
}

/**
 * Convert PCM Float32Array to WAV Blob
 * WAV format is widely supported by Whisper APIs
 */
function pcmToWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const bufferSize = 44 + dataSize // WAV header is 44 bytes

  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  // WAV header
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // file size - 8
  writeString(view, 8, 'WAVE')

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // subchunk1 size (16 for PCM)
  view.setUint16(20, 1, true) // audio format (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample

  // "data" sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write PCM samples (convert float to 16-bit int)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit signed int
    const s = Math.max(-1, Math.min(1, samples[i]))
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF
    view.setInt16(offset, val, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Check if Whisper API is available
 */
export async function checkWhisperAvailability(modelName: string = 'whisper-1'): Promise<boolean> {
  if (!isServerTranscriptionEnabled()) {
    console.log('[Transcription] Server transcription not configured')
    return false
  }

  // For OpenAI, we can't easily check model availability without making a request
  // Just return true if API key is configured
  console.log(`[Transcription] Whisper API configured with model ${modelName}`)
  return true
}

/**
 * Model preloading is not needed for API-based transcription
 */
export async function preloadModel(_modelName: string = 'whisper-1'): Promise<void> {
  // No-op for API-based transcription
  console.log('[Transcription] Model preloading not needed for API-based transcription')
}
