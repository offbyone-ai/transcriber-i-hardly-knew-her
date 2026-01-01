import type { TranscriptionSegment } from 'shared'
import { mkdirSync, existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import path from 'path'
import { $ } from 'bun'

// Paths configuration
const WHISPER_BIN = process.env.WHISPER_BIN || '/usr/local/bin/whisper'
const MODEL_DIR = process.env.MODEL_DIR || '/app/models'
const TEMP_DIR = process.env.TEMP_DIR || '/tmp'

// Model mapping for whisper.cpp (ggml format)
const MODEL_MAP: Record<string, string> = {
  'tiny': 'ggml-tiny.bin',
  'tiny.en': 'ggml-tiny.en.bin',
  'base': 'ggml-base.bin',
  'base.en': 'ggml-base.en.bin',
  'small': 'ggml-small.bin',
  'small.en': 'ggml-small.en.bin',
}

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true })
}

console.log(`🤖 Whisper.cpp binary: ${WHISPER_BIN}`)
console.log(`📁 Model directory: ${MODEL_DIR}`)

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
 * Write Float32Array audio data to a WAV file (16kHz mono)
 */
function writeWavFile(audioData: Float32Array, filePath: string): void {
  const sampleRate = 16000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = audioData.length * 2 // 16-bit = 2 bytes per sample

  // Create WAV header (44 bytes)
  const buffer = Buffer.alloc(44 + dataSize)
  
  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  
  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20)  // audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  
  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  
  // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const int16 = sample < 0 ? sample * 32768 : sample * 32767
    buffer.writeInt16LE(Math.round(int16), 44 + i * 2)
  }
  
  writeFileSync(filePath, buffer)
}

/**
 * Parse whisper.cpp JSON output
 */
interface WhisperSegment {
  timestamps: {
    from: string
    to: string
  }
  offsets: {
    from: number
    to: number
  }
  text: string
}

interface WhisperOutput {
  transcription: WhisperSegment[]
}

function parseWhisperOutput(jsonPath: string): { text: string; segments: TranscriptionSegment[] } {
  const content = readFileSync(jsonPath, 'utf-8')
  const output: WhisperOutput = JSON.parse(content)
  
  const segments: TranscriptionSegment[] = output.transcription.map(seg => ({
    start: seg.offsets.from / 1000, // Convert ms to seconds
    end: seg.offsets.to / 1000,
    text: seg.text.trim(),
  }))
  
  const text = segments.map(s => s.text).join(' ').trim()
  
  return { text, segments }
}

/**
 * Transcribe audio from Float32Array (16kHz mono) using whisper.cpp
 */
export async function transcribeAudio(
  audioData: Float32Array,
  options: TranscriptionOptions = {}
): Promise<ServerTranscriptionResult> {
  const startTime = performance.now()
  const modelName = options.modelName || 'base.en'
  const modelFile = MODEL_MAP[modelName] || MODEL_MAP['base.en']
  const modelPath = path.join(MODEL_DIR, modelFile)
  
  console.log(`🎙️ Starting transcription with model: ${modelName}`)
  console.log(`📊 Audio data: ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s at 16kHz)`)
  
  // Check if model exists
  if (!existsSync(modelPath)) {
    throw new Error(`Model not found: ${modelPath}. Please download the model first.`)
  }
  
  // Generate unique temp file names
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const wavPath = path.join(TEMP_DIR, `audio-${tempId}.wav`)
  const jsonPath = path.join(TEMP_DIR, `output-${tempId}.json`)
  
  try {
    // Write audio to WAV file
    writeWavFile(audioData, wavPath)
    console.log(`📝 Wrote temp WAV file: ${wavPath}`)
    
    // Build whisper.cpp command
    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-oj',           // Output JSON
      '-of', jsonPath.replace('.json', ''), // Output file prefix (whisper adds .json)
      '--no-prints',   // Suppress progress output
    ]
    
    // Add language option for non-English models
    if (!modelName.includes('.en') && options.language) {
      args.push('-l', options.language)
    }
    
    console.log(`🔧 Running: ${WHISPER_BIN} ${args.join(' ')}`)
    
    // Run whisper.cpp
    const result = await $`${WHISPER_BIN} ${args}`.quiet()
    
    if (result.exitCode !== 0) {
      throw new Error(`Whisper.cpp failed with exit code ${result.exitCode}: ${result.stderr.toString()}`)
    }
    
    // Parse JSON output
    const { text, segments } = parseWhisperOutput(jsonPath)
    
    const endTime = performance.now()
    const processingTimeMs = Math.round(endTime - startTime)
    
    console.log(`✅ Transcription complete in ${(processingTimeMs / 1000).toFixed(1)}s`)
    
    return {
      text,
      segments,
      language: options.language || 'en',
      processingTimeMs,
    }
  } finally {
    // Clean up temp files
    try {
      if (existsSync(wavPath)) unlinkSync(wavPath)
      if (existsSync(jsonPath)) unlinkSync(jsonPath)
    } catch (e) {
      console.warn('Failed to clean up temp files:', e)
    }
  }
}

/**
 * Check if whisper.cpp and model are available
 */
export async function checkWhisperAvailability(modelName: string = 'base.en'): Promise<boolean> {
  const modelFile = MODEL_MAP[modelName] || MODEL_MAP['base.en']
  const modelPath = path.join(MODEL_DIR, modelFile)
  
  // Check if binary exists
  if (!existsSync(WHISPER_BIN)) {
    console.error(`❌ Whisper binary not found: ${WHISPER_BIN}`)
    return false
  }
  
  // Check if model exists
  if (!existsSync(modelPath)) {
    console.error(`❌ Model not found: ${modelPath}`)
    return false
  }
  
  console.log(`✅ Whisper.cpp ready with model: ${modelName}`)
  return true
}

/**
 * Pre-load check (for compatibility with existing code)
 */
export async function preloadModel(modelName: string = 'base.en'): Promise<void> {
  const available = await checkWhisperAvailability(modelName)
  if (!available) {
    throw new Error(`Model ${modelName} is not available`)
  }
}
