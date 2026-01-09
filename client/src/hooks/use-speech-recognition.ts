/**
 * Web Speech API hook for real-time speech recognition
 * 
 * Uses the browser's built-in SpeechRecognition API for fast, low-resource
 * real-time transcription. Less accurate than Whisper but much faster.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

// Types for the Web Speech API (not fully typed in TypeScript)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

// Interface for the SpeechRecognition instance
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

// Get the SpeechRecognition constructor (browser-specific)
const SpeechRecognitionCtor: (new () => ISpeechRecognition) | undefined = 
  typeof window !== 'undefined' 
    ? (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition
    : undefined

export type TranscriptSegment = {
  text: string
  timestamp: number
  isFinal: boolean
}

export type UseSpeechRecognitionOptions = {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

export type UseSpeechRecognitionReturn = {
  isSupported: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  segments: TranscriptSegment[]
  start: () => void
  stop: () => void
  reset: () => void
  error: string | null
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    language = navigator?.language || 'en-US',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const startTimeRef = useRef<number>(0)
  const restartTimeoutRef = useRef<number | null>(null)
  const shouldRestartRef = useRef<boolean>(false)

  const isSupported = !!SpeechRecognitionCtor

  // Clean up on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore errors on cleanup
        }
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
    }
  }, [])

  // Store callbacks in refs to avoid stale closures
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  
  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
  }, [onResult, onError])

  const start = useCallback(() => {
    if (!isSupported || !SpeechRecognitionCtor) {
      const errorMsg = 'Speech recognition is not supported in this browser. Try Chrome or Edge.'
      setError(errorMsg)
      onErrorRef.current?.(errorMsg)
      return
    }

    // Stop any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
      recognitionRef.current = null
    }

    setError(null)
    shouldRestartRef.current = true
    
    // Create new recognition instance
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = language
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    
    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started, lang:', language)
      setIsListening(true)
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now()
      }
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interim = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        
        if (result.isFinal) {
          finalTranscript += text
          
          // Add to segments
          const segment: TranscriptSegment = {
            text: text.trim(),
            timestamp: (Date.now() - startTimeRef.current) / 1000,
            isFinal: true,
          }
          
          if (segment.text) {
            console.log('[SpeechRecognition] Final result:', segment.text)
            setSegments(prev => [segment, ...prev]) // Add to beginning (newest first)
          }
        } else {
          interim += text
        }
      }
      
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript)
        onResultRef.current?.(finalTranscript, true)
      }
      
      setInterimTranscript(interim)
      if (interim) {
        onResultRef.current?.(interim, false)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechRecognition] Error:', event.error, event.message)
      
      // Don't treat 'no-speech' as a fatal error - just continue
      if (event.error === 'no-speech') {
        console.log('[SpeechRecognition] No speech detected, continuing...')
        return
      }
      
      // 'aborted' happens when we intentionally stop
      if (event.error === 'aborted') {
        return
      }
      
      // 'not-allowed' means microphone permission denied
      if (event.error === 'not-allowed') {
        const errorMsg = 'Microphone access denied. Please allow microphone access and try again.'
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
        shouldRestartRef.current = false
        setIsListening(false)
        return
      }
      
      // For other errors (like 'network', 'service-not-allowed', etc.)
      // Stop auto-restart but preserve existing transcript
      const errorMsg = `Speech recognition error: ${event.error}`
      setError(errorMsg)
      onErrorRef.current?.(errorMsg)
      shouldRestartRef.current = false
      setIsListening(false)
      
      // NOTE: We intentionally DO NOT clear segments/transcript here
      // to preserve user's data even when recognition fails
    }

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended, shouldRestart:', shouldRestartRef.current)
      
      // Auto-restart if we're still supposed to be listening
      // (Chrome stops after a period of silence)
      if (shouldRestartRef.current) {
        console.log('[SpeechRecognition] Auto-restarting...')
        restartTimeoutRef.current = window.setTimeout(() => {
          if (shouldRestartRef.current) {
            try {
              // Create a fresh instance for restart
              const newRecognition = new SpeechRecognitionCtor!()
              newRecognition.lang = recognition.lang
              newRecognition.continuous = recognition.continuous
              newRecognition.interimResults = recognition.interimResults
              newRecognition.onstart = recognition.onstart
              newRecognition.onresult = recognition.onresult
              newRecognition.onerror = recognition.onerror
              newRecognition.onend = recognition.onend
              recognitionRef.current = newRecognition
              newRecognition.start()
            } catch (e) {
              console.error('[SpeechRecognition] Failed to restart:', e)
              setIsListening(false)
              shouldRestartRef.current = false
            }
          }
        }, 100)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    
    try {
      recognition.start()
    } catch (e) {
      console.error('[SpeechRecognition] Failed to start:', e)
      const errorMsg = 'Failed to start speech recognition. Please check microphone permissions.'
      setError(errorMsg)
      onErrorRef.current?.(errorMsg)
      shouldRestartRef.current = false
    }
  }, [isSupported, language, continuous, interimResults])

  const stop = useCallback(() => {
    console.log('[SpeechRecognition] Stopping...')
    
    shouldRestartRef.current = false
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore errors when stopping
      }
      recognitionRef.current = null
    }
    
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)
    startTimeRef.current = 0
  }, [stop])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    segments,
    start,
    stop,
    reset,
    error,
  }
}
