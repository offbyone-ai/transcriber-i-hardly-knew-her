import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, Play, Pause, AlertCircle, Upload, Loader2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { db, addRecording } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { type RealtimeTranscriptionChunk, transcribeAudio } from '@/lib/transcription'
import { getPreferredModel } from '@/lib/model-manager'
import type { Subject, Recording } from '@shared/types'

export default function RecordPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  
  // Tab state
  const [mode, setMode] = useState<'record' | 'upload' | 'live'>('record')
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadDuration, setUploadDuration] = useState<number | null>(null)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)
  
  // Real-time transcription state
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [realtimeChunks, setRealtimeChunks] = useState<RealtimeTranscriptionChunk[]>([])
  const [isRealtimeProcessing, setIsRealtimeProcessing] = useState(false)
  const realtimeIntervalRef = useRef<number | null>(null)
  const recordingTimeRef = useRef<number>(0)
  
  // Form state
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [title, setTitle] = useState('')
  
  // Audio state
  const [frequencyData, setFrequencyData] = useState<number[]>(Array(40).fill(0))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const ONE_HOUR = 3600 // seconds
  const TWO_HOURS = 7200 // seconds
  
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
    setRealtimeChunks([])
    
    // Enable real-time transcription if in 'live' mode
    const enableRealtime = mode === 'live' || realtimeEnabled
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      })
      
      streamRef.current = stream

      // Setup audio analyzer for visualization
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8 // Smooth out the visualization
      source.connect(analyser)
      analyserRef.current = analyser
      
      console.log('Audio analyzer setup complete, starting visualization')
      updateAudioLevel()

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
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
      
      // Start recording with timeslice to collect data regularly
      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      
      // Setup real-time transcription if enabled
      if (enableRealtime) {
        const modelName = getPreferredModel()
        const TRANSCRIPTION_INTERVAL = 10000 // 10 seconds
        let lastTranscribedLength = 0
        
        // Process audio every 10 seconds
        realtimeIntervalRef.current = window.setInterval(async () => {
          if (audioChunksRef.current.length === 0) {
            console.log('[Real-time] No audio data yet, skipping')
            return
          }
          
          // Require at least 5 seconds of audio before first transcription
          if (audioChunksRef.current.length < 5 && lastTranscribedLength === 0) {
            console.log('[Real-time] Waiting for more audio data before first transcription...')
            return
          }
          
          // Create blob from ALL audio collected so far
          // This is less efficient but produces valid WebM that can be decoded
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
          console.log('[Real-time] Transcribing full recording, size:', audioBlob.size, 'bytes, chunks:', audioChunksRef.current.length)
          
          setIsRealtimeProcessing(true)
          
          try {
            const result = await transcribeAudio({
              audioBlob,
              modelName,
              language: 'en',
            })
            
            console.log('[Real-time] Transcription complete, text length:', result.text.length, 'full text:', result.text)
            
            // If result is empty and we haven't transcribed anything yet, warn user
            if (result.text.length === 0 && lastTranscribedLength === 0) {
              console.warn('[Real-time] No speech detected yet. Make sure you are speaking clearly into the microphone.')
            }
            
            // Only show NEW text (after what we've already shown)
            const newText = result.text.substring(lastTranscribedLength)
            
            if (newText.trim()) {
              lastTranscribedLength = result.text.length
              
              const chunk: RealtimeTranscriptionChunk = {
                text: newText,
                timestamp: recordingTimeRef.current,
                segments: result.segments
              }
              
              console.log('[Real-time] Adding new chunk:', chunk)
              setRealtimeChunks(prev => [...prev, chunk])
            } else {
              console.log('[Real-time] No new text to add')
            }
          } catch (error) {
            console.error('[Real-time] Transcription error:', error)
          } finally {
            setIsRealtimeProcessing(false)
          }
        }, TRANSCRIPTION_INTERVAL)
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

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Clean up real-time transcription
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current)
      realtimeIntervalRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setIsRealtimeProcessing(false)
  }

  function togglePause() {
    if (!mediaRecorderRef.current) return

    if (isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    } else {
      mediaRecorderRef.current.pause()
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
    
    // Debug: log max value occasionally
    const maxValue = Math.max(...bars)
    if (Math.random() < 0.01) { // Log 1% of the time
      console.log('Waveform max value:', maxValue.toFixed(3), 'bars sample:', bars.slice(0, 5).map(v => v.toFixed(2)))
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
    
    // Show warning if MIME type doesn't match but extension is valid
    if (!isValidMimeType && isValidExtension) {
      console.warn(`File has unexpected MIME type (${file.type}) but valid extension (.${fileExt}). Attempting to load...`)
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
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Timeout loading audio metadata. The file may be corrupted or in an unsupported format.'))
      }, 10000) // 10 second timeout
      
      const cleanup = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(audio.src)
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('error', onError)
      }
      
      const onLoaded = () => {
        cleanup()
        // Check if duration is valid
        if (!isFinite(audio.duration) || audio.duration <= 0) {
          reject(new Error('Could not determine audio duration. The file may be corrupted.'))
          return
        }
        resolve(audio.duration)
      }
      
      const onError = (e: ErrorEvent | Event) => {
        cleanup()
        console.error('Audio loading error:', e)
        
        // Provide more specific error message
        const errorMsg = audio.error?.message || 'Unknown error loading audio'
        reject(new Error(`Failed to load audio file: ${errorMsg}. This may be due to an unsupported codec or corrupted file.`))
      }
      
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('error', onError)
      
      // Create object URL and set as source
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
      
      // Navigate to the recording detail page
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

  const showWarning = recordingTime >= ONE_HOUR && recordingTime < TWO_HOURS

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Record or Upload Audio</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Record audio, enable live transcription, or upload an existing file
          </p>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-input p-1 bg-muted w-full sm:w-auto">
            <button
              onClick={() => setMode('record')}
              disabled={isRecording}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'record' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Mic size={16} />
              Record
            </button>
            <button
              onClick={() => setMode('live')}
              disabled={isRecording}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'live' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Loader2 size={16} />
              Live
            </button>
            <button
              onClick={() => setMode('upload')}
              disabled={isRecording}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
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

        {(mode === 'record' || mode === 'live') ? (
          // Recording UI
          <>
            <Card className="p-6 sm:p-8 md:p-12">
              <div className="flex flex-col items-center gap-6 sm:gap-8">
                {/* Waveform visualization */}
                <div className="w-full h-24 sm:h-32 bg-accent rounded-lg flex items-center justify-center">
                  <div className="flex items-end gap-0.5 sm:gap-1 h-16 sm:h-24">
                    {frequencyData.map((value, i) => {
                      // Amplify the values and add minimum height
                      const height = isRecording && !isPaused 
                        ? Math.max(10, Math.min(100, value * 200)) // Amplify by 2x, min 10%, max 100%
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
            
            {/* Real-time transcription display */}
            {(mode === 'live' || realtimeEnabled) && isRecording && (
              <Card className="p-4 sm:p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold">Real-time Transcription</h3>
                    {isRealtimeProcessing && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 size={14} className="animate-spin" />
                        Processing...
                      </span>
                    )}
                  </div>
                  {realtimeChunks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {recordingTime < 5 ? (
                        <p>Waiting for at least 5 seconds of audio before first transcription...</p>
                      ) : recordingTime < 15 ? (
                        <p>First transcription starting soon...</p>
                      ) : isRealtimeProcessing ? (
                        <p>Processing first transcription (this may take 30-60 seconds)...</p>
                      ) : (
                        <>
                          <p>No speech detected yet.</p>
                          <p className="text-xs mt-2">Make sure you're speaking clearly into the microphone.</p>
                        </>
                      )}
                      <p className="text-xs mt-2 text-muted-foreground/70">Transcription updates every 10 seconds</p>
                    </div>
                  ) : (
                    <div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-2 text-sm">
                      {realtimeChunks.map((chunk, idx) => (
                        <div key={idx} className="p-2 sm:p-3 bg-accent rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatTime(Math.floor(chunk.timestamp))}
                          </div>
                          <div className="text-xs sm:text-sm">{chunk.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Note: Real-time transcription is approximate. A final, more accurate transcription will be available after stopping the recording.
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

        {/* Form fields */}
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
          
          {mode === 'live' && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-xs sm:text-sm text-foreground">
                <strong>Live Transcription Mode:</strong> Audio will be transcribed in real-time as you record. 
                New transcription appears every 10 seconds. This mode uses more CPU and battery.
              </p>
            </div>
          )}
          
          {mode === 'record' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="realtime-transcription" className="text-sm sm:text-base">Real-time Transcription</Label>
                <input
                  id="realtime-transcription"
                  type="checkbox"
                  checked={realtimeEnabled}
                  onChange={(e) => setRealtimeEnabled(e.target.checked)}
                  disabled={isRecording}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Transcribe audio in real-time as you record (experimental). This uses more CPU and battery.
              </p>
            </div>
          )}

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
