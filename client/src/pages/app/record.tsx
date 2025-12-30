import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, Play, Pause, AlertCircle, Upload, Monitor, RefreshCw, Languages } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { db, addRecording } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useSpeechRecognition, type TranscriptSegment } from '@/hooks/use-speech-recognition'
import type { Subject, Recording } from '@shared/types'

// Common language options for speech recognition
const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
]

export default function RecordPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  
  // Mode state (simplified to just record or upload)
  const [mode, setMode] = useState<'record' | 'upload'>('record')
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadDuration, setUploadDuration] = useState<number | null>(null)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)
  
  // Live transcription options (toggles instead of separate modes)
  const [liveTranscriptionEnabled, setLiveTranscriptionEnabled] = useState(false)
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    // Try to match browser language to our options
    const browserLang = navigator?.language || 'en-US'
    const match = LANGUAGE_OPTIONS.find(opt => opt.code === browserLang || opt.code.startsWith(browserLang.split('-')[0]))
    return match?.code || 'en-US'
  })
  const [noSpeechWarning, setNoSpeechWarning] = useState(false)
  const [systemAudioError, setSystemAudioError] = useState<string | null>(null)
  
  // Transcript segments from Web Speech API (newest first)
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([])
  const [interimText, setInterimText] = useState('')
  
  // Track recording time for transcript timestamps
  const recordingTimeRef = useRef<number>(0)
  const noSpeechTimeoutRef = useRef<number | null>(null)
  
  // Form state
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [title, setTitle] = useState('')
  
  // Audio state
  const [frequencyData, setFrequencyData] = useState<number[]>(Array(40).fill(0))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null) // For system audio capture
  const timerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const ONE_HOUR = 3600 // seconds
  const TWO_HOURS = 7200 // seconds
  const NO_SPEECH_WARNING_DELAY = 30000 // 30 seconds
  
  const ACCEPTED_AUDIO_TYPES = [
    'audio/mpeg', // MP3
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/flac',
    'audio/x-flac',
  ]

  // Web Speech Recognition hook
  const speechRecognition = useSpeechRecognition({
    language: selectedLanguage,
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      // Got speech, clear warning
      setNoSpeechWarning(false)
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current)
        noSpeechTimeoutRef.current = null
      }
      // Reset the no-speech warning timer
      startNoSpeechTimer()
      
      if (isFinal && text.trim()) {
        setTranscriptSegments(prev => [{
          text: text.trim(),
          timestamp: recordingTimeRef.current,
          isFinal: true
        }, ...prev])
        setInterimText('')
      } else {
        setInterimText(text)
      }
    },
    onError: (err) => {
      console.error('[SpeechRecognition] Error:', err)
      // Don't show error for common non-fatal issues
      if (!err.includes('no-speech') && !err.includes('aborted')) {
        setError(err)
      }
    }
  })

  // Start timer to warn if no speech detected
  function startNoSpeechTimer() {
    if (noSpeechTimeoutRef.current) {
      clearTimeout(noSpeechTimeoutRef.current)
    }
    noSpeechTimeoutRef.current = window.setTimeout(() => {
      if (isRecording && liveTranscriptionEnabled && transcriptSegments.length === 0) {
        setNoSpeechWarning(true)
      }
    }, NO_SPEECH_WARNING_DELAY)
  }

  // Load subjects on mount
  useEffect(() => {
    loadSubjects()
  }, [session])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current)
      }
    }
  }, [])

  async function loadSubjects() {
    if (!session?.user?.id) return
    
    try {
      const userSubjects = await db.subjects
        .where('userId')
        .equals(session.user.id)
        .reverse()
        .sortBy('createdAt')
      setSubjects(userSubjects)
      
      // Auto-select first subject if available
      if (userSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(userSubjects[0].id)
      }
    } catch (err) {
      console.error('Failed to load subjects:', err)
    }
  }

  async function startRecording() {
    setError(null)
    setSystemAudioError(null)
    setTranscriptSegments([])
    setInterimText('')
    setNoSpeechWarning(false)
    
    try {
      let micStream: MediaStream | null = null
      let displayStream: MediaStream | null = null
      let combinedStream: MediaStream
      
      // Get microphone stream
      micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      })
      streamRef.current = micStream
      
      // If system audio is enabled, get display media with audio
      if (systemAudioEnabled) {
        try {
          console.log('[System Audio] Requesting display media with audio...')
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required, but we'll ignore it
            audio: {
              // @ts-expect-error - suppressLocalAudioPlayback is a newer API
              suppressLocalAudioPlayback: false,
            }
          })
          displayStreamRef.current = displayStream
          
          // Check if we got audio tracks
          const audioTracks = displayStream.getAudioTracks()
          if (audioTracks.length === 0) {
            console.warn('[System Audio] No audio track in display stream. User may not have enabled "Share audio"')
            setSystemAudioError('No audio captured from tab. Make sure to check "Share audio" when sharing.')
          } else {
            console.log('[System Audio] Got display audio track:', audioTracks[0].label)
          }
          
          // Stop video track - we only need audio
          displayStream.getVideoTracks().forEach(track => {
            console.log('[System Audio] Stopping video track:', track.label)
            track.stop()
          })
          
          // Mix mic and display audio streams using Web Audio API
          const audioContext = new AudioContext({ sampleRate: 44100 })
          const destination = audioContext.createMediaStreamDestination()
          
          // Add mic to mix
          const micSource = audioContext.createMediaStreamSource(micStream)
          micSource.connect(destination)
          
          // Add display audio to mix (if available)
          if (audioTracks.length > 0) {
            const displaySource = audioContext.createMediaStreamSource(displayStream)
            displaySource.connect(destination)
            console.log('[System Audio] Mixed mic + system audio')
          }
          
          combinedStream = destination.stream
          
        } catch (displayError) {
          console.error('[System Audio] Failed to get display media:', displayError)
          // Clean up mic stream
          micStream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          
          if (displayError instanceof Error && displayError.name === 'NotAllowedError') {
            setSystemAudioError('Screen sharing was cancelled. Please try again and select a tab to share.')
          } else {
            setSystemAudioError('Failed to capture system audio. Please try again.')
          }
          return
        }
      } else {
        // Regular mode - just use mic stream
        combinedStream = micStream
      }

      // Setup audio analyzer for visualization (use combined stream)
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(combinedStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8 // Smooth out the visualization
      source.connect(analyser)
      analyserRef.current = analyser
      
      console.log('Audio analyzer setup complete, starting visualization')
      updateAudioLevel()

      // Create MediaRecorder with the combined stream
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      audioChunksRef.current = []
      
      // Collect audio chunks continuously
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[Recording] Data available, size:', event.data.size, 'bytes')
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = handleRecordingComplete
      mediaRecorderRef.current = mediaRecorder
      
      // Start MediaRecorder
      mediaRecorder.start(1000) // Collect data every second
      console.log('[Recording] MediaRecorder started')
      
      // Start speech recognition if enabled
      if (liveTranscriptionEnabled) {
        console.log('[Recording] Starting speech recognition...')
        speechRecognition.start()
        startNoSpeechTimer()
      }
      
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimeRef.current = 0
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          recordingTimeRef.current = newTime
          
          // Auto-stop at 2 hours
          if (newTime >= TWO_HOURS) {
            stopRecording()
          }
          
          return newTime
        })
      }, 1000)
      
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Failed to access microphone. Please grant permission and try again.')
    }
  }

  async function stopRecording() {
    // Stop the timer first
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Stop no-speech warning timer
    if (noSpeechTimeoutRef.current) {
      clearTimeout(noSpeechTimeoutRef.current)
      noSpeechTimeoutRef.current = null
    }
    
    // Stop speech recognition
    if (liveTranscriptionEnabled) {
      console.log('[Recording] Stopping speech recognition...')
      speechRecognition.stop()
    }
    
    // Now stop the MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    // Stop the audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Stop the display stream (for system audio)
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach(track => track.stop())
      displayStreamRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setNoSpeechWarning(false)
  }

  function togglePause() {
    if (!mediaRecorderRef.current) return

    if (isPaused) {
      mediaRecorderRef.current.resume()
      if (liveTranscriptionEnabled) {
        speechRecognition.start()
      }
      setIsPaused(false)
    } else {
      mediaRecorderRef.current.pause()
      if (liveTranscriptionEnabled) {
        speechRecognition.stop()
      }
      setIsPaused(true)
    }
  }

  async function handleRecordingComplete() {
    if (audioChunksRef.current.length === 0) {
      setError('No audio data recorded')
      return
    }

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
      
      // Use ref value to get the actual recording time (state might be stale)
      const actualDuration = recordingTimeRef.current
      console.log('[Record] Saving recording with duration:', actualDuration)
      
      const recording: Recording = {
        id: crypto.randomUUID(),
        subjectId: selectedSubjectId || undefined,
        userId: session!.user!.id as string,
        title: title.trim() || undefined,
        audioBlob,
        duration: actualDuration,
        fileSize: audioBlob.size,
        source: 'recording',
        createdAt: new Date(),
      }

      await addRecording(recording)
      
      // Navigate to the recording detail page
      navigate(`/recordings/${recording.id}`)
    } catch (err) {
      console.error('Failed to save recording:', err)
      setError('Failed to save recording')
    }
  }

  function updateAudioLevel() {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Get frequency data for waveform bars (40 bars)
    const barCount = 40
    const samplesPerBar = Math.floor(bufferLength / barCount)
    const bars: number[] = []
    
    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar
      const end = start + samplesPerBar
      const slice = dataArray.slice(start, end)
      const barAverage = slice.reduce((a, b) => a + b, 0) / slice.length
      bars.push(barAverage / 255) // Normalize to 0-1
    }
    
    setFrequencyData(bars)
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }

  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    
    setError(null)
    
    // Validate file type - check both MIME type and extension
    const isValidMimeType = ACCEPTED_AUDIO_TYPES.includes(file.type)
    const fileExt = file.name.toLowerCase().split('.').pop()
    const validExtensions = ['mp3', 'wav', 'webm', 'ogg', 'opus', 'm4a', 'mp4', 'flac']
    const isValidExtension = fileExt && validExtensions.includes(fileExt)
    
    if (!isValidMimeType && !isValidExtension) {
      setError(`Unsupported file type: ${file.type || 'unknown'}. Please upload MP3, WAV, M4A, OGG, FLAC, or WebM files.`)
      return
    }
    
    // Validate file size (max 500MB)
    const MAX_SIZE = 500 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setError('File is too large. Maximum size is 500MB.')
      return
    }
    
    setSelectedFile(file)
    
    // Get audio duration
    try {
      const duration = await getAudioDuration(file)
      setUploadDuration(Math.floor(duration))
      
      // Auto-fill title with filename if not already set
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
        setTitle(nameWithoutExt)
      }
    } catch (err) {
      console.error('Failed to get audio duration:', err)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to read audio file: ${errorMsg}`)
      setSelectedFile(null)
    }
  }
  
  async function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Timeout loading audio metadata. The file may be corrupted or in an unsupported format.'))
      }, 10000)
      
      const cleanup = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(audio.src)
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('error', onError)
      }
      
      const onLoaded = () => {
        cleanup()
        if (!isFinite(audio.duration) || audio.duration <= 0) {
          reject(new Error('Could not determine audio duration. The file may be corrupted.'))
          return
        }
        resolve(audio.duration)
      }
      
      const onError = (e: ErrorEvent | Event) => {
        cleanup()
        console.error('Audio loading error:', e)
        const errorMsg = audio.error?.message || 'Unknown error loading audio'
        reject(new Error(`Failed to load audio file: ${errorMsg}. This may be due to an unsupported codec or corrupted file.`))
      }
      
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('error', onError)
      
      try {
        audio.src = URL.createObjectURL(file)
      } catch (err) {
        cleanup()
        reject(new Error('Failed to create audio preview. The file may be corrupted.'))
      }
    })
  }
  
  async function handleUploadSave() {
    if (!selectedFile || !uploadDuration) return
    
    setIsProcessingUpload(true)
    setError(null)
    
    try {
      const recording: Recording = {
        id: crypto.randomUUID(),
        subjectId: selectedSubjectId || undefined,
        userId: session!.user!.id as string,
        title: title.trim() || undefined,
        audioBlob: selectedFile,
        duration: uploadDuration,
        fileSize: selectedFile.size,
        source: 'upload',
        originalFileName: selectedFile.name,
        createdAt: new Date(),
      }
      
      await addRecording(recording)
      
      navigate(`/recordings/${recording.id}`)
    } catch (err) {
      console.error('Failed to save uploaded file:', err)
      setError('Failed to save uploaded file')
    } finally {
      setIsProcessingUpload(false)
    }
  }
  
  function handleClearFile() {
    setSelectedFile(null)
    setUploadDuration(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  function retrySystemAudio() {
    setSystemAudioError(null)
    startRecording()
  }

  const showWarning = recordingTime >= ONE_HOUR && recordingTime < TWO_HOURS

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Record or Upload Audio</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Record audio or upload an existing file for transcription
          </p>
        </div>
        
        {/* Mode Toggle - Simplified to Record | Upload */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-input p-1 bg-muted w-full sm:w-auto">
            <button
              onClick={() => setMode('record')}
              disabled={isRecording}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'record' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Mic size={16} />
              Record
            </button>
            <button
              onClick={() => setMode('upload')}
              disabled={isRecording}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'upload' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Upload size={16} />
              Upload
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <Card className="p-3 sm:p-4 bg-destructive/10 border-destructive">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm">{error}</p>
            </div>
          </Card>
        )}
        
        {/* System Audio Error with Retry */}
        {systemAudioError && !isRecording && (
          <Card className="p-3 sm:p-4 bg-destructive/10 border-destructive">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm">{systemAudioError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={retrySystemAudio}
                className="flex items-center gap-1"
              >
                <RefreshCw size={14} />
                Retry
              </Button>
            </div>
          </Card>
        )}

        {mode === 'record' ? (
          // Recording UI
          <>
            {/* Recording Options - Collapsed when recording */}
            {!isRecording && (
              <Card className="p-4 sm:p-6 space-y-4">
                <h3 className="font-semibold text-sm sm:text-base">Recording Options</h3>
                
                {/* Live Transcription Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="live-transcription" className="text-sm sm:text-base cursor-pointer">
                        Live Transcription
                      </Label>
                      {!speechRecognition.isSupported && (
                        <span className="text-xs text-muted-foreground">(Not supported)</span>
                      )}
                    </div>
                    <input
                      id="live-transcription"
                      type="checkbox"
                      checked={liveTranscriptionEnabled}
                      onChange={(e) => setLiveTranscriptionEnabled(e.target.checked)}
                      disabled={!speechRecognition.isSupported}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    See transcription in real-time as you speak. Uses browser speech recognition (fast but less accurate).
                  </p>
                </div>
                
                {/* Language Selector (only shown when live transcription is enabled) */}
                {liveTranscriptionEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Languages size={16} className="text-muted-foreground" />
                      <Label htmlFor="language" className="text-sm">Language</Label>
                    </div>
                    <select
                      id="language"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* System Audio Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor size={16} className="text-muted-foreground" />
                      <Label htmlFor="system-audio" className="text-sm sm:text-base cursor-pointer">
                        Include System Audio
                      </Label>
                    </div>
                    <input
                      id="system-audio"
                      type="checkbox"
                      checked={systemAudioEnabled}
                      onChange={(e) => setSystemAudioEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Also record audio from a browser tab (Discord, Google Meet, etc.). You'll be asked to share a tab when recording starts.
                  </p>
                </div>
              </Card>
            )}
            
            {/* Active options summary when recording */}
            {isRecording && (liveTranscriptionEnabled || systemAudioEnabled) && (
              <div className="flex flex-wrap gap-2 justify-center text-xs">
                {liveTranscriptionEnabled && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Live transcription
                  </span>
                )}
                {systemAudioEnabled && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                    <Monitor size={12} />
                    System audio
                  </span>
                )}
              </div>
            )}

            <Card className="p-6 sm:p-8 md:p-12">
              <div className="flex flex-col items-center gap-6 sm:gap-8">
                {/* Waveform visualization */}
                <div className="w-full h-24 sm:h-32 bg-accent rounded-lg flex items-center justify-center">
                  <div className="flex items-end gap-0.5 sm:gap-1 h-16 sm:h-24">
                    {frequencyData.map((value, i) => {
                      const height = isRecording && !isPaused 
                        ? Math.max(10, Math.min(100, value * 200))
                        : 10
                      
                      return (
                        <div
                          key={i}
                          className="w-0.5 sm:w-1 bg-primary rounded-full transition-all duration-75"
                          style={{ height: `${height}%` }}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Timer */}
                <div className="text-3xl sm:text-4xl font-mono font-bold">
                  {formatTime(recordingTime)}
                </div>

                {/* Warning message */}
                {showWarning && (
                  <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-500 text-center sm:text-left">
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm">
                      {recordingTime >= TWO_HOURS - 60 
                        ? 'Recording will stop automatically at 2 hours' 
                        : 'You have been recording for over 1 hour'}
                    </p>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      size="lg"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
                      disabled={!session}
                    >
                      <Mic size={24} className="sm:hidden" />
                      <Mic size={32} className="hidden sm:block" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={togglePause}
                        variant="secondary"
                        size="lg"
                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full"
                      >
                        {isPaused ? (
                          <>
                            <Play size={20} className="sm:hidden" />
                            <Play size={24} className="hidden sm:block" />
                          </>
                        ) : (
                          <>
                            <Pause size={20} className="sm:hidden" />
                            <Pause size={24} className="hidden sm:block" />
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={stopRecording}
                        variant="destructive"
                        size="lg"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
                      >
                        <Square size={24} className="sm:hidden" />
                        <Square size={32} className="hidden sm:block" />
                      </Button>
                    </>
                  )}
                </div>

                {isRecording && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isPaused ? 'Recording paused' : 'Recording in progress...'}
                  </p>
                )}
              </div>
            </Card>
            
            {/* Live transcription display */}
            {liveTranscriptionEnabled && isRecording && (
              <Card className="p-4 sm:p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold">Live Transcription</h3>
                    {speechRecognition.isListening && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Listening
                      </span>
                    )}
                  </div>
                  
                  {/* No speech warning */}
                  {noSpeechWarning && transcriptSegments.length === 0 && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-700 dark:text-yellow-400">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <div className="text-xs sm:text-sm">
                        <p className="font-medium">No speech detected</p>
                        <p className="mt-1">Make sure you're speaking clearly into the microphone.</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Interim text (currently being spoken) */}
                  {interimText && (
                    <div className="p-2 sm:p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="text-xs sm:text-sm italic text-muted-foreground">
                        {interimText}
                      </div>
                    </div>
                  )}
                  
                  {/* Final transcript segments (newest first) */}
                  {transcriptSegments.length === 0 && !interimText ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <p>Waiting for speech...</p>
                      <p className="text-xs mt-2">Start speaking and your words will appear here.</p>
                    </div>
                  ) : (
                    <div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-2 text-sm">
                      {transcriptSegments.map((segment, idx) => (
                        <div key={idx} className="p-2 sm:p-3 bg-accent rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatTime(Math.floor(segment.timestamp))}
                          </div>
                          <div className="text-xs sm:text-sm">{segment.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Live transcription uses your browser's speech recognition. A more accurate Whisper transcription will be available on the recording detail page.
                  </p>
                </div>
              </Card>
            )}
          </>
        ) : (
          // Upload UI
          <Card className="p-6 sm:p-8 md:p-12">
            <div className="flex flex-col items-center gap-6">
              <div className="w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="audio-file-input"
                />
                
                {!selectedFile ? (
                  <label
                    htmlFor="audio-file-input"
                    className="flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed border-input rounded-lg cursor-pointer hover:border-primary transition-colors bg-accent/50"
                  >
                    <Upload size={40} className="sm:hidden text-muted-foreground mb-4" />
                    <Upload size={48} className="hidden sm:block text-muted-foreground mb-4" />
                    <p className="text-base sm:text-lg font-medium mb-2 px-4 text-center">Click to upload audio file</p>
                    <p className="text-xs sm:text-sm text-muted-foreground px-4 text-center">
                      Supports MP3, WAV, M4A, OGG, FLAC, WebM
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max file size: 500MB
                    </p>
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 sm:p-6 border border-input rounded-lg bg-accent/50">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-base sm:text-lg mb-2 break-words">{selectedFile.name}</p>
                          <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                            <p>Size: {formatFileSize(selectedFile.size)}</p>
                            {uploadDuration && (
                              <p>Duration: {formatTime(uploadDuration)}</p>
                            )}
                            <p>Type: {selectedFile.type || 'Unknown'}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFile}
                          disabled={isProcessingUpload}
                          className="w-full sm:w-auto"
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleUploadSave}
                      disabled={!session || isProcessingUpload}
                      className="w-full"
                      size="lg"
                    >
                      {isProcessingUpload ? 'Saving...' : 'Save Recording'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Form fields (Subject & Title) */}
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <select
              id="subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={isRecording || isProcessingUpload}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm sm:text-base"
            >
              <option value="">No subject (optional)</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Recording Title (Optional)</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isRecording || isProcessingUpload}
              placeholder="Untitled Recording"
              className="text-sm sm:text-base"
            />
          </div>

          {subjects.length === 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              No subjects available. Recordings will be saved without a subject.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
