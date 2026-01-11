/**
 * Live Whisper Transcription Hook
 *
 * Uses LiveAudioCapture to capture raw PCM audio and sends it directly
 * to the Whisper model for transcription. This bypasses WebM encoding
 * issues and provides more accurate results than the Web Speech API.
 */

import { useState, useRef, useCallback } from 'react'
import { LiveAudioCapture, type LiveAudioChunk } from '@/lib/live-audio-capture'
import { transcribePCM } from '@/lib/transcription'
import { getPreferredModel } from '@/lib/model-manager'
import type { TranscriptionSegment } from '@shared/types'

export type LiveWhisperSegment = {
  id: string
  text: string
  start: number
  end: number
  isFinal: boolean
}

export type LiveWhisperOptions = {
  chunkDuration?: number      // Duration of each chunk in seconds (default: 5)
  overlapDuration?: number    // Overlap between chunks for continuity (default: 1)
  language?: string           // Language code (default: 'en')
  modelName?: string          // Whisper model name (uses preferred model if not set)
  onSegment?: (segment: LiveWhisperSegment) => void
  onError?: (error: string) => void
}

export type LiveWhisperState = {
  isListening: boolean
  isProcessing: boolean
  segments: LiveWhisperSegment[]
  interimText: string
  error: string | null
}

export function useLiveWhisper(options: LiveWhisperOptions = {}) {
  const {
    chunkDuration = 5,
    language = 'en',
    modelName,
    onSegment,
    onError,
  } = options

  const [state, setState] = useState<LiveWhisperState>({
    isListening: false,
    isProcessing: false,
    segments: [],
    interimText: '',
    error: null,
  })

  const captureRef = useRef<LiveAudioCapture | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isStoppingRef = useRef(false)
  const chunkQueueRef = useRef<LiveAudioChunk[]>([])
  const processingRef = useRef(false)
  const segmentIdRef = useRef(0)
  const recordingStartTimeRef = useRef(0)

  const processChunk = useCallback(async (chunk: LiveAudioChunk) => {
    const effectiveModel = modelName || getPreferredModel()

    try {
      setState(prev => ({ ...prev, isProcessing: true, interimText: 'Transcribing...' }))

      const result = await transcribePCM(
        chunk.samples,
        effectiveModel,
        language
      )

      if (result.text.trim()) {
        const newSegment: LiveWhisperSegment = {
          id: `segment-${segmentIdRef.current++}`,
          text: result.text.trim(),
          start: chunk.startTime,
          end: chunk.endTime,
          isFinal: true,
        }

        setState(prev => ({
          ...prev,
          segments: [...prev.segments, newSegment],
          interimText: '',
          isProcessing: chunkQueueRef.current.length > 0,
        }))

        onSegment?.(newSegment)
      } else {
        setState(prev => ({
          ...prev,
          interimText: '',
          isProcessing: chunkQueueRef.current.length > 0,
        }))
      }
    } catch (error) {
      console.error('[LiveWhisper] Transcription error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Transcription failed'
      setState(prev => ({ ...prev, error: errorMsg, isProcessing: false }))
      onError?.(errorMsg)
    }
  }, [modelName, language, onSegment, onError])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    if (chunkQueueRef.current.length === 0) return

    processingRef.current = true

    while (chunkQueueRef.current.length > 0 && !isStoppingRef.current) {
      const chunk = chunkQueueRef.current.shift()
      if (chunk) {
        await processChunk(chunk)
      }
    }

    processingRef.current = false
    setState(prev => ({ ...prev, isProcessing: false }))
  }, [processChunk])

  const handleChunkReady = useCallback((chunk: LiveAudioChunk) => {
    console.log('[LiveWhisper] Chunk ready:', {
      samples: chunk.samples.length,
      start: chunk.startTime.toFixed(2),
      end: chunk.endTime.toFixed(2),
    })

    // Add to queue and process
    chunkQueueRef.current.push(chunk)
    setState(prev => ({ ...prev, isProcessing: true }))
    processQueue()
  }, [processQueue])

  const start = useCallback(async (stream?: MediaStream) => {
    try {
      isStoppingRef.current = false
      chunkQueueRef.current = []
      segmentIdRef.current = 0

      setState({
        isListening: true,
        isProcessing: false,
        segments: [],
        interimText: '',
        error: null,
      })

      // Get or use provided stream
      let audioStream = stream
      if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          }
        })
      }
      streamRef.current = audioStream

      // Create and start audio capture
      captureRef.current = new LiveAudioCapture({
        sampleRate: 16000, // Whisper expects 16kHz
        chunkDuration,
        onChunkReady: handleChunkReady,
      })

      recordingStartTimeRef.current = performance.now()
      await captureRef.current.start(audioStream)

      console.log('[LiveWhisper] Started listening')
    } catch (error) {
      console.error('[LiveWhisper] Failed to start:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to start live transcription'
      setState(prev => ({
        ...prev,
        isListening: false,
        error: errorMsg,
      }))
      onError?.(errorMsg)
    }
  }, [chunkDuration, handleChunkReady, onError])

  const stop = useCallback(async () => {
    console.log('[LiveWhisper] Stopping...')
    isStoppingRef.current = true

    // Stop capture
    if (captureRef.current) {
      // Flush any remaining audio
      const finalChunk = captureRef.current.flush()
      if (finalChunk && finalChunk.samples.length > 0) {
        // Only process if there's meaningful audio (at least 0.5 seconds)
        if (finalChunk.samples.length >= 8000) { // 0.5s at 16kHz
          chunkQueueRef.current.push(finalChunk)
        }
      }

      captureRef.current.stop()
      captureRef.current = null
    }

    // Stop stream (only if we created it)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setState(prev => ({ ...prev, isListening: false }))

    // Process any remaining chunks
    if (chunkQueueRef.current.length > 0) {
      setState(prev => ({ ...prev, isProcessing: true }))
      await processQueue()
    }

    console.log('[LiveWhisper] Stopped')
  }, [processQueue])

  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      segments: [],
      interimText: '',
      error: null,
    }))
    segmentIdRef.current = 0
    chunkQueueRef.current = []
  }, [])

  // Get all segments as TranscriptionSegment format
  const getTranscriptionSegments = useCallback((): TranscriptionSegment[] => {
    return state.segments.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }))
  }, [state.segments])

  // Get full text from all segments
  const getFullText = useCallback((): string => {
    return state.segments.map(seg => seg.text).join(' ')
  }, [state.segments])

  return {
    ...state,
    start,
    stop,
    clear,
    getTranscriptionSegments,
    getFullText,
  }
}
