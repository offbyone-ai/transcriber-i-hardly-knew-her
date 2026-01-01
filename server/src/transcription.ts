import { pipeline, env } from '@huggingface/transformers'
import type { TranscriptionSegment } from 'shared'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'path'

// Configure transformers.js for server-side usage
env.allowLocalModels = true
env.allowRemoteModels = true
env.cacheDir = process.env.MODEL_CACHE_PATH || path.join(process.cwd(), '.cache', 'models')

// Ensure cache directory exists
if (!existsSync(env.cacheDir)) {
  mkdirSync(env.cacheDir, { recursive: true })
}

console.log(`🤖 Model cache directory: ${env.cacheDir}`)
console.log('✅ No ffmpeg required - client sends pre-processed audio')

// Model mapping
const MODEL_MAP: Record<string, string> = {
  'tiny': 'Xenova/whisper-tiny',
  'tiny.en': 'Xenova/whisper-tiny.en',
  'base': 'Xenova/whisper-base',
  'base.en': 'Xenova/whisper-base.en',
  'small': 'Xenova/whisper-small',
  'small.en': 'Xenova/whisper-small.en',
}

// Singleton pipeline cache
let transcriber: any = null
let currentModel: string = ''

export type ServerTranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  language: string
  processingTimeMs: number
}

export type TranscriptionOptions = {
  modelName?: string
  language?: string
}

/**
 * Get or create the transcription pipeline
 */
async function getTranscriber(modelName: string = 'base.en') {
  const modelId = MODEL_MAP[modelName] || MODEL_MAP['base.en']
  
  if (transcriber && currentModel === modelId) {
    return transcriber
  }
  
  console.log(`📥 Loading Whisper model: ${modelId}...`)
  const startTime = performance.now()
  
  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    // Progress callback for model download
    progress_callback: (progress: any) => {
      if (progress.status === 'progress') {
        console.log(`   Downloading ${progress.file}: ${progress.progress?.toFixed(1)}%`)
      }
    }
  })
  
  currentModel = modelId || 'Xenova/whisper-base.en'
  const loadTime = ((performance.now() - startTime) / 1000).toFixed(1)
  console.log(`✅ Model loaded in ${loadTime}s`)
  
  return transcriber
}

/**
 * Transcribe audio from Float32Array (16kHz mono)
 * Client should pre-process audio to this format
 */
export async function transcribeAudio(
  audioData: Float32Array,
  options: TranscriptionOptions = {}
): Promise<ServerTranscriptionResult> {
  const startTime = performance.now()
  const modelName = options.modelName || 'base.en'
  
  console.log(`🎙️ Starting transcription with model: ${modelName}`)
  console.log(`📊 Audio data: ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s at 16kHz)`)
  
  // Get the pipeline
  const pipe = await getTranscriber(modelName)
  
  // Transcription options
  const isEnglishOnly = modelName.includes('.en')
  const transcriptionOptions: any = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  }
  
  if (!isEnglishOnly && options.language) {
    transcriptionOptions.language = options.language
  }
  
  // Run transcription
  const result = await pipe(audioData, transcriptionOptions)
  
  const endTime = performance.now()
  const processingTimeMs = Math.round(endTime - startTime)
  
  // Format result
  const output = Array.isArray(result) ? result[0] : result
  const segments: TranscriptionSegment[] = []
  
  if (output.chunks && Array.isArray(output.chunks)) {
    for (const chunk of output.chunks) {
      segments.push({
        start: chunk.timestamp[0] || 0,
        end: chunk.timestamp[1] || 0,
        text: chunk.text.trim(),
      })
    }
  }
  
  console.log(`✅ Transcription complete in ${(processingTimeMs / 1000).toFixed(1)}s`)
  
  return {
    text: output.text.trim(),
    segments,
    language: options.language || 'en',
    processingTimeMs,
  }
}

/**
 * Pre-load a model (useful for warm start)
 */
export async function preloadModel(modelName: string = 'base.en'): Promise<void> {
  await getTranscriber(modelName)
}
