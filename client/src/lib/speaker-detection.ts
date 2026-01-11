// Speaker detection using silence-based segmentation
// Detects speaker changes by analyzing silence gaps in audio

import type { SpeakerLabel, SpeakerSegment, TranscriptionSegment } from '@shared/types'

export type SpeakerDetectionOptions = {
  silenceThreshold?: number      // RMS threshold below which audio is considered silence (0-1)
  minSilenceDuration?: number    // Minimum silence duration to consider as speaker change (seconds)
  windowSize?: number            // Analysis window size in samples
  minSpeechDuration?: number     // Minimum speech segment duration (seconds)
}

const DEFAULT_OPTIONS: Required<SpeakerDetectionOptions> = {
  silenceThreshold: 0.02,        // 2% of max amplitude
  minSilenceDuration: 0.5,       // 500ms silence = potential speaker change
  windowSize: 1024,              // ~23ms at 44.1kHz
  minSpeechDuration: 0.3,        // Ignore speech segments shorter than 300ms
}

// Default speaker colors for UI
const SPEAKER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

/**
 * Calculate RMS (Root Mean Square) energy of an audio buffer segment
 */
function calculateRMS(samples: Float32Array, start: number, length: number): number {
  let sum = 0
  const end = Math.min(start + length, samples.length)
  const actualLength = end - start

  for (let i = start; i < end; i++) {
    sum += samples[i] * samples[i]
  }

  return Math.sqrt(sum / actualLength)
}

/**
 * Detect silence regions in audio data
 */
export function detectSilenceRegions(
  audioData: Float32Array,
  sampleRate: number,
  options: SpeakerDetectionOptions = {}
): Array<{ start: number; end: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const windowSamples = opts.windowSize
  const silenceRegions: Array<{ start: number; end: number }> = []

  let silenceStart: number | null = null

  for (let i = 0; i < audioData.length; i += windowSamples) {
    const rms = calculateRMS(audioData, i, windowSamples)
    const timeInSeconds = i / sampleRate

    if (rms < opts.silenceThreshold) {
      // In silence
      if (silenceStart === null) {
        silenceStart = timeInSeconds
      }
    } else {
      // In speech
      if (silenceStart !== null) {
        const silenceEnd = timeInSeconds
        const silenceDuration = silenceEnd - silenceStart

        if (silenceDuration >= opts.minSilenceDuration) {
          silenceRegions.push({ start: silenceStart, end: silenceEnd })
        }
        silenceStart = null
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    const silenceEnd = audioData.length / sampleRate
    const silenceDuration = silenceEnd - silenceStart

    if (silenceDuration >= opts.minSilenceDuration) {
      silenceRegions.push({ start: silenceStart, end: silenceEnd })
    }
  }

  return silenceRegions
}

/**
 * Detect speaker changes based on silence gaps
 * Returns speech segments with alternating speaker IDs
 */
export function detectSpeakerChanges(
  audioData: Float32Array,
  sampleRate: number,
  options: SpeakerDetectionOptions = {}
): SpeakerSegment[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const silenceRegions = detectSilenceRegions(audioData, sampleRate, options)
  const audioDuration = audioData.length / sampleRate

  const speakerSegments: SpeakerSegment[] = []
  let currentSpeaker = 0
  let lastEnd = 0

  for (const silence of silenceRegions) {
    // Add speech segment before this silence
    if (silence.start > lastEnd) {
      const speechDuration = silence.start - lastEnd

      if (speechDuration >= opts.minSpeechDuration) {
        speakerSegments.push({
          speakerId: `speaker-${currentSpeaker + 1}`,
          start: lastEnd,
          end: silence.start,
        })

        // Alternate speaker at each significant silence gap
        currentSpeaker = (currentSpeaker + 1) % 2
      }
    }

    lastEnd = silence.end
  }

  // Add final speech segment
  if (lastEnd < audioDuration) {
    const speechDuration = audioDuration - lastEnd

    if (speechDuration >= opts.minSpeechDuration) {
      speakerSegments.push({
        speakerId: `speaker-${currentSpeaker + 1}`,
        start: lastEnd,
        end: audioDuration,
      })
    }
  }

  return speakerSegments
}

/**
 * Create default speaker labels for the detected speakers
 */
export function createSpeakerLabels(speakerSegments: SpeakerSegment[]): SpeakerLabel[] {
  const uniqueSpeakers = new Set(speakerSegments.map(s => s.speakerId))
  const labels: SpeakerLabel[] = []

  let colorIndex = 0
  for (const speakerId of uniqueSpeakers) {
    const speakerNum = parseInt(speakerId.replace('speaker-', ''))
    labels.push({
      id: speakerId,
      name: `Speaker ${speakerNum}`,
      color: SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length],
    })
    colorIndex++
  }

  return labels
}

/**
 * Apply speaker segments to transcription segments
 * Assigns speaker IDs to transcription segments based on time overlap
 */
export function applySpeakersToSegments(
  transcriptionSegments: TranscriptionSegment[],
  speakerSegments: SpeakerSegment[]
): TranscriptionSegment[] {
  return transcriptionSegments.map(segment => {
    // Find the speaker segment that best overlaps with this transcription segment
    const segmentMidpoint = (segment.start + segment.end) / 2

    let bestMatch: SpeakerSegment | null = null
    let bestOverlap = 0

    for (const speaker of speakerSegments) {
      // Calculate overlap
      const overlapStart = Math.max(segment.start, speaker.start)
      const overlapEnd = Math.min(segment.end, speaker.end)
      const overlap = Math.max(0, overlapEnd - overlapStart)

      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestMatch = speaker
      }

      // Also check if midpoint falls within this speaker segment
      if (segmentMidpoint >= speaker.start && segmentMidpoint < speaker.end) {
        bestMatch = speaker
        break
      }
    }

    return {
      ...segment,
      speakerId: bestMatch?.speakerId,
    }
  })
}

/**
 * Extract audio data from a Blob for analysis
 */
export async function extractAudioData(audioBlob: Blob): Promise<{ data: Float32Array; sampleRate: number }> {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContext = new AudioContext()

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Get mono audio data (mix down if stereo)
    let audioData: Float32Array

    if (audioBuffer.numberOfChannels === 1) {
      audioData = audioBuffer.getChannelData(0)
    } else {
      // Mix down to mono
      const length = audioBuffer.length
      audioData = new Float32Array(length)
      const numChannels = audioBuffer.numberOfChannels

      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < length; i++) {
          audioData[i] += channelData[i] / numChannels
        }
      }
    }

    return { data: audioData, sampleRate: audioBuffer.sampleRate }
  } finally {
    await audioContext.close()
  }
}

/**
 * Run full speaker diarization on an audio blob
 */
export async function runSpeakerDiarization(
  audioBlob: Blob,
  transcriptionSegments: TranscriptionSegment[],
  options: SpeakerDetectionOptions = {}
): Promise<{
  segments: TranscriptionSegment[]
  speakerLabels: SpeakerLabel[]
  speakerSegments: SpeakerSegment[]
}> {
  // Extract audio data
  const { data, sampleRate } = await extractAudioData(audioBlob)

  // Detect speaker changes
  const speakerSegments = detectSpeakerChanges(data, sampleRate, options)

  // Create speaker labels
  const speakerLabels = createSpeakerLabels(speakerSegments)

  // Apply speakers to transcription segments
  const segments = applySpeakersToSegments(transcriptionSegments, speakerSegments)

  return { segments, speakerLabels, speakerSegments }
}

/**
 * Merge adjacent segments with the same speaker
 */
export function mergeAdjacentSpeakerSegments(
  segments: TranscriptionSegment[]
): TranscriptionSegment[] {
  if (segments.length === 0) return []

  const merged: TranscriptionSegment[] = []
  let current = { ...segments[0] }

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]

    if (next.speakerId === current.speakerId) {
      // Merge with current
      current.end = next.end
      current.text = current.text + ' ' + next.text
    } else {
      // Push current and start new
      merged.push(current)
      current = { ...next }
    }
  }

  // Push final segment
  merged.push(current)

  return merged
}

/**
 * Update speaker label name
 */
export function updateSpeakerLabel(
  labels: SpeakerLabel[],
  speakerId: string,
  newName: string
): SpeakerLabel[] {
  return labels.map(label =>
    label.id === speakerId ? { ...label, name: newName } : label
  )
}

/**
 * Get speaker label by ID
 */
export function getSpeakerLabel(
  labels: SpeakerLabel[],
  speakerId: string | undefined
): SpeakerLabel | undefined {
  if (!speakerId) return undefined
  return labels.find(l => l.id === speakerId)
}
