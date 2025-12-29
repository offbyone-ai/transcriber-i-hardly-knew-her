export type ApiResponse = {
  message: string;
  success: true;
}

// Auth types
export type User = {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export type Session = {
  session: {
    id: string
    userId: string
    expiresAt: Date
    token: string
    ipAddress?: string
    userAgent?: string
  }
  user: User
}

// Subject types
export type Subject = {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

// Recording types
export type RecordingSource = 'recording' | 'upload'

export type Recording = {
  id: string
  subjectId?: string
  title?: string
  audioBlob: Blob
  duration: number // seconds
  fileSize: number // bytes
  source: RecordingSource // whether this was recorded or uploaded
  originalFileName?: string // for uploaded files
  createdAt: Date
  userId: string
}

// Transcription types
export type TranscriptionSegment = {
  start: number // timestamp in seconds
  end: number
  text: string
  confidence?: number
}

export type Transcription = {
  id: string
  recordingId: string
  text: string
  segments: TranscriptionSegment[]
  language: string
  modelUsed: string
  processingTimeMs?: number // time taken to transcribe in milliseconds
  createdAt: Date
  userId: string
}

// Whisper model types
export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en'

export type WhisperModelInfo = {
  name: WhisperModel
  size: number // bytes
  url: string
  description: string
}

export const WHISPER_MODELS: Record<WhisperModel, WhisperModelInfo> = {
  'tiny': {
    name: 'tiny',
    size: 75 * 1024 * 1024, // 75MB
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    description: 'Tiny model - Fast, lower accuracy'
  },
  'tiny.en': {
    name: 'tiny.en',
    size: 75 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    description: 'Tiny English-only - Fast, lower accuracy'
  },
  'base': {
    name: 'base',
    size: 142 * 1024 * 1024, // 142MB
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    description: 'Base model - Balanced speed and accuracy'
  },
  'base.en': {
    name: 'base.en',
    size: 142 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    description: 'Base English-only - Balanced (Recommended)'
  },
  'small': {
    name: 'small',
    size: 466 * 1024 * 1024, // 466MB
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    description: 'Small model - Slower, better accuracy'
  },
  'small.en': {
    name: 'small.en',
    size: 466 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    description: 'Small English-only - Slower, better accuracy'
  },
}
