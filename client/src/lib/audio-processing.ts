// Audio processing utilities for Whisper transcription

/**
 * Convert audio Blob to 16kHz mono Float32Array for Whisper
 */
export async function convertAudioForWhisper(audioBlob: Blob): Promise<Float32Array> {
  console.log('[AudioProcessing] Converting audio, blob size:', audioBlob.size, 'type:', audioBlob.type)
  
  // Create an AudioContext
  const audioContext = new AudioContext({ sampleRate: 16000 })
  
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer()
    console.log('[AudioProcessing] ArrayBuffer size:', arrayBuffer.byteLength)
    
    // Decode audio data
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log('[AudioProcessing] Decoded successfully, duration:', audioBuffer.duration, 's, sample rate:', audioBuffer.sampleRate)
    } catch (decodeError) {
      console.error('[AudioProcessing] Failed to decode audio data:', decodeError)
      console.error('[AudioProcessing] Blob type:', audioBlob.type)
      console.error('[AudioProcessing] Blob size:', audioBlob.size)
      throw new Error('EncodingError: Unable to decode audio data')
    }
    
    // Get audio data (convert to mono if needed)
    let audioData: Float32Array
    
    if (audioBuffer.numberOfChannels === 1) {
      audioData = audioBuffer.getChannelData(0)
    } else {
      // Mix down to mono
      const left = audioBuffer.getChannelData(0)
      const right = audioBuffer.getChannelData(1)
      audioData = new Float32Array(left.length)
      
      for (let i = 0; i < left.length; i++) {
        audioData[i] = (left[i] + right[i]) / 2
      }
    }
    
    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      console.log('[AudioProcessing] Resampling from', audioBuffer.sampleRate, 'to 16000 Hz')
      audioData = await resampleAudio(audioData, audioBuffer.sampleRate, 16000)
    }
    
    console.log('[AudioProcessing] Final audio data length:', audioData.length, 'samples')
    return audioData
  } finally {
    await audioContext.close()
  }
}

/**
 * Resample audio from one sample rate to another
 */
async function resampleAudio(
  audioData: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Promise<Float32Array> {
  if (fromSampleRate === toSampleRate) {
    return audioData
  }
  
  // Create offline audio context with target sample rate
  const offlineContext = new OfflineAudioContext(
    1, // mono
    Math.ceil(audioData.length * toSampleRate / fromSampleRate),
    toSampleRate
  )
  
  // Create buffer with original sample rate
  const buffer = offlineContext.createBuffer(1, audioData.length, fromSampleRate)
  buffer.copyToChannel(new Float32Array(audioData), 0)
  
  // Create source
  const source = offlineContext.createBufferSource()
  source.buffer = buffer
  source.connect(offlineContext.destination)
  source.start(0)
  
  // Render and get resampled data
  const renderedBuffer = await offlineContext.startRendering()
  return renderedBuffer.getChannelData(0)
}

/**
 * Calculate audio duration from sample count and sample rate
 */
export function calculateDuration(samples: number, sampleRate: number = 16000): number {
  return samples / sampleRate
}
