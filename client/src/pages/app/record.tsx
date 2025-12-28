import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, Play, Pause, AlertCircle, Upload } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { db, addRecording } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import type { Subject, Recording } from '@shared/types'

export default function RecordPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  
  // Tab state
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
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/flac',
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
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = handleRecordingComplete
      
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          
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
    
    setIsRecording(false)
    setIsPaused(false)
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
      
      const recording: Recording = {
        id: crypto.randomUUID(),
        subjectId: selectedSubjectId || undefined,
        userId: session!.user!.id as string,
        title: title.trim() || undefined,
        audioBlob,
        duration: recordingTime,
        fileSize: audioBlob.size,
        source: 'recording',
        createdAt: new Date(),
      }

      await addRecording(recording)
      
      // Navigate to the recording detail page
      navigate(`/app/recordings/${recording.id}`)
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
    
    // Validate file type
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      setError(`Unsupported file type: ${file.type}. Please upload MP3, WAV, M4A, OGG, FLAC, or WebM files.`)
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
      setError('Failed to read audio file. Please ensure it is a valid audio file.')
      setSelectedFile(null)
    }
  }
  
  async function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
        resolve(audio.duration)
      }
      
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src)
        reject(new Error('Failed to load audio metadata'))
      }
      
      audio.src = URL.createObjectURL(file)
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
      navigate(`/app/recordings/${recording.id}`)
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
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Record Audio</h1>
          <p className="text-muted-foreground mt-2">
            Record audio for transcription
          </p>
        </div>

        {/* Error message */}
        {error && (
          <Card className="p-4 bg-destructive/10 border-destructive">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          </Card>
        )}

        {/* Recording UI */}
        <Card className="p-12">
          <div className="flex flex-col items-center gap-8">
            {/* Waveform visualization */}
            <div className="w-full h-32 bg-accent rounded-lg flex items-center justify-center">
              <div className="flex items-end gap-1 h-24">
                {frequencyData.map((value, i) => {
                  // Amplify the values and add minimum height
                  const height = isRecording && !isPaused 
                    ? Math.max(10, Math.min(100, value * 200)) // Amplify by 2x, min 10%, max 100%
                    : 10
                  
                  return (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full transition-all duration-75"
                      style={{ height: `${height}%` }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Timer */}
            <div className="text-4xl font-mono font-bold">
              {formatTime(recordingTime)}
            </div>

            {/* Warning message */}
            {showWarning && (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                <AlertCircle size={20} />
                <p className="text-sm">
                  {recordingTime >= TWO_HOURS - 60 
                    ? 'Recording will stop automatically at 2 hours' 
                    : 'You have been recording for over 1 hour'}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="w-20 h-20 rounded-full"
                  disabled={!session}
                >
                  <Mic size={32} />
                </Button>
              ) : (
                <>
                  <Button
                    onClick={togglePause}
                    variant="secondary"
                    size="lg"
                    className="w-16 h-16 rounded-full"
                  >
                    {isPaused ? <Play size={24} /> : <Pause size={24} />}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="w-20 h-20 rounded-full"
                  >
                    <Square size={32} />
                  </Button>
                </>
              )}
            </div>

            {isRecording && (
              <p className="text-sm text-muted-foreground">
                {isPaused ? 'Recording paused' : 'Recording in progress...'}
              </p>
            )}
          </div>
        </Card>

        {/* Form fields */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <select
              id="subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={isRecording}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
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
              disabled={isRecording}
              placeholder="Untitled Recording"
            />
          </div>

          {subjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No subjects available. Recordings will be saved without a subject.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
