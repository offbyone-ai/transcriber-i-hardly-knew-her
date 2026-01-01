// Server-side transcription is currently disabled.
// All transcription runs locally in the browser using the client's GPU.
// 
// This file is kept as a placeholder for future server-side transcription
// implementation (e.g., using whisper.cpp or other backends).

export type ServerTranscriptionResult = {
  text: string
  segments: { start: number; end: number; text: string }[]
  language: string
  processingTimeMs: number
}

export type TranscriptionOptions = {
  modelName?: string
  language?: string
}

/**
 * Server transcription is disabled.
 * All transcription runs locally in the browser.
 */
export async function transcribeAudio(
  _audioData: Float32Array,
  _options: TranscriptionOptions = {}
): Promise<ServerTranscriptionResult> {
  throw new Error('Server transcription is disabled. Please use local (in-browser) transcription.')
}

/**
 * Server transcription is disabled.
 */
export async function preloadModel(_modelName: string = 'base.en'): Promise<void> {
  throw new Error('Server transcription is disabled. Model preloading is not available.')
}

/**
 * Server transcription is disabled.
 */
export async function checkWhisperAvailability(_modelName: string = 'base.en'): Promise<boolean> {
  return false
}
