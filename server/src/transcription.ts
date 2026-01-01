import { pipeline, env } from '@huggingface/transformers'
import type { TranscriptionSegment } from 'shared'
import { mkdirSync, existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'path'
import os from 'node:os'

// Configure transformers.js for server-side usage
env.allowLocalModels = true
env.allowRemoteModels = true
env.cacheDir = process.env.MODEL_CACHE_PATH || path.join(process.cwd(), '.cache', 'models')

// Ensure cache directory exists
if (!existsSync(env.cacheDir)) {
  mkdirSync(env.cacheDir, { recursive: true })
}

console.log(`🤖 Model cache directory: ${env.cacheDir}`)

// Check if ffmpeg is available
let ffmpegAvailable = false
try {
  const result = Bun.spawnSync(['which', 'ffmpeg'])
  ffmpegAvailable = result.exitCode === 0
  if (ffmpegAvailable) {
    console.log('✅ ffmpeg found - audio decoding enabled')
  } else {
    console.warn('⚠️ ffmpeg not found - server transcription may not work with encoded audio')
  }
} catch {
  console.warn('⚠️ Could not check for ffmpeg')
}

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
 * Decode audio from various formats (WebM, MP3, etc.) to raw PCM Float32Array
 * Uses ffmpeg for reliable decoding
 */
async function decodeAudioToFloat32(audioBuffer: ArrayBuffer): Promise<Float32Array> {
  if (!ffmpegAvailable) {
    // Fallback: assume it's already raw 16-bit PCM (legacy behavior)
    console.log('⚠️ ffmpeg not available, attempting raw PCM interpretation')
    const int16 = new Int16Array(audioBuffer)
    const audioData = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      audioData[i] = (int16[i] ?? 0) / 32768.0
    }
    return audioData
  }
  
  // Create temp files for ffmpeg processing
  const tempDir = os.tmpdir()
  const inputPath = path.join(tempDir, `input-${Date.now()}.webm`)
  const outputPath = path.join(tempDir, `output-${Date.now()}.raw`)
  
  try {
    // Write input audio to temp file
    writeFileSync(inputPath, Buffer.from(audioBuffer))
    console.log(`📁 Wrote input audio: ${inputPath} (${audioBuffer.byteLength} bytes)`)
    
    // Run ffmpeg to convert to raw PCM
    // Output: 16kHz mono 16-bit signed little-endian PCM
    const ffmpegArgs = [
      '-i', inputPath,
      '-ar', '16000',       // 16kHz sample rate (Whisper expects this)
      '-ac', '1',           // Mono
      '-f', 's16le',        // 16-bit signed little-endian
      '-acodec', 'pcm_s16le',
      '-y',                 // Overwrite output
      outputPath
    ]
    
    console.log(`🔧 Running ffmpeg: ffmpeg ${ffmpegArgs.join(' ')}`)
    
    const result = Bun.spawnSync(['ffmpeg', ...ffmpegArgs], {
      stderr: 'pipe',
    })
    
    if (result.exitCode !== 0) {
      const stderr = result.stderr ? Buffer.from(result.stderr).toString() : 'Unknown error'
      console.error('❌ ffmpeg failed:', stderr)
      throw new Error(`ffmpeg failed: ${stderr.slice(0, 200)}`)
    }
    
    // Read the raw PCM output
    const rawPcm = readFileSync(outputPath)
    console.log(`📁 Read output audio: ${outputPath} (${rawPcm.byteLength} bytes)`)
    
    // Convert 16-bit PCM to Float32
    const int16 = new Int16Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.byteLength / 2)
    const audioData = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      audioData[i] = (int16[i] ?? 0) / 32768.0
    }
    
    console.log(`✅ Decoded audio: ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s at 16kHz)`)
    
    return audioData
  } finally {
    // Cleanup temp files
    try { unlinkSync(inputPath) } catch {}
    try { unlinkSync(outputPath) } catch {}
  }
}

/**
 * Transcribe audio from a buffer
 */
export async function transcribeAudio(
  audioBuffer: ArrayBuffer | Float32Array,
  options: TranscriptionOptions = {}
): Promise<ServerTranscriptionResult> {
  const startTime = performance.now()
  const modelName = options.modelName || 'base.en'
  
  console.log(`🎙️ Starting transcription with model: ${modelName}`)
  
  // Get the pipeline
  const pipe = await getTranscriber(modelName)
  
  // Convert to Float32Array if needed
  let audioData: Float32Array
  if (audioBuffer instanceof ArrayBuffer) {
    // Decode from encoded format (WebM, MP3, etc.) to PCM
    audioData = await decodeAudioToFloat32(audioBuffer)
  } else {
    audioData = audioBuffer
  }
  
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
