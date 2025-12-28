import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Play, Pause, Loader2 } from 'lucide-react'
import { db, deleteRecording, addTranscription } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSession } from '@/lib/auth-client'
import { getPreferredModel } from '@/lib/model-manager'
import { transcribeAudio, type TranscriptionProgress } from '@/lib/transcription'
import type { Recording, Transcription } from '@shared/types'

export default function RecordingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const [recording, setRecording] = useState<Recording | null>(null)
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null)

  useEffect(() => {
    loadRecordingData()
    
    return () => {
      // Cleanup audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [id])

  async function loadRecordingData() {
    if (!id) return

    setIsLoading(true)
    try {
      // Load recording
      const recordingData = await db.recordings.get(id)
      if (!recordingData) {
        navigate('/app/subjects')
        return
      }
      setRecording(recordingData)

      // Create audio URL from blob
      const url = URL.createObjectURL(recordingData.audioBlob)
      setAudioUrl(url)

      // Load transcription if exists
      const transcriptionData = await db.transcriptions
        .where('recordingId')
        .equals(id)
        .first()
      setTranscription(transcriptionData || null)
    } catch (error) {
      console.error('Failed to load recording:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this recording and its transcription?')) return

    try {
      await deleteRecording(id)
      
      // Navigate back to subject or subjects list
      if (recording?.subjectId) {
        navigate(`/app/subjects/${recording.subjectId}`)
      } else {
        navigate('/app/subjects')
      }
    } catch (error) {
      console.error('Failed to delete recording:', error)
    }
  }

  async function handleTranscribe() {
    if (!recording || !session?.user?.id) return

    const preferredModel = getPreferredModel()
    
    setIsTranscribing(true)
    setTranscriptionProgress(null)

    try {
      const result = await transcribeAudio(
        {
          audioBlob: recording.audioBlob,
          modelName: preferredModel,
          // Note: language is optional, undefined means auto-detect
        },
        (progress) => {
          setTranscriptionProgress(progress)
        }
      )

      // Save transcription to database
      const newTranscription: Transcription = {
        id: crypto.randomUUID(),
        recordingId: recording.id,
        userId: session.user.id as string,
        text: result.text,
        segments: result.segments,
        language: result.language,
        modelUsed: preferredModel,
        createdAt: new Date(),
      }

      await addTranscription(newTranscription)
      setTranscription(newTranscription)
    } catch (error) {
      console.error('Transcription failed:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      alert(`Transcription failed: ${errorMsg}\n\nCheck the browser console for more details.`)
    } finally {
      setIsTranscribing(false)
      setTranscriptionProgress(null)
    }
  }

  function handleDownload() {
    if (!audioUrl || !recording) return
    
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `${recording.title || 'recording'}.webm`
    a.click()
  }

  function togglePlayPause() {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  function handleLoadedMetadata() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current) return

    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!recording) {
    return null
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link 
            to={recording.subjectId ? `/app/subjects/${recording.subjectId}` : '/app/subjects'}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft size={16} />
            Back to subject
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{recording.title || 'Untitled Recording'}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Recorded on {new Date(recording.createdAt).toLocaleDateString()} • {formatTime(recording.duration)} • {(recording.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleDownload}>
                <Download size={20} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        <Card className="p-6">
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
          
          <div className="flex items-center gap-4">
            <Button
              variant="default"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={togglePlayPause}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </Button>
            
            <div className="flex-1">
              <div 
                className="h-2 bg-accent rounded-full cursor-pointer"
                onClick={handleSeek}
              >
                <div 
                  className="h-2 bg-primary rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Transcription */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Transcription</h2>
            {!transcription && (
              <Button 
                variant="default" 
                size="sm"
                onClick={handleTranscribe}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  'Start Transcription'
                )}
              </Button>
            )}
          </div>

          {/* Transcription progress */}
          {isTranscribing && transcriptionProgress && (
            <div className="mb-6">
              <div className="h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${transcriptionProgress.progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {transcriptionProgress.message || 'Processing...'}
              </p>
            </div>
          )}
          
          {transcription ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Language: {transcription.language || 'auto'}</span>
                <span>Model: {transcription.modelUsed}</span>
                <span>Created: {new Date(transcription.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-foreground">
                  {transcription.text}
                </div>
              </div>

              {transcription.segments && transcription.segments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-3">Segments</h3>
                  <div className="space-y-2">
                    {transcription.segments.map((segment, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="text-muted-foreground w-20 flex-shrink-0">
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </div>
                        <div>{segment.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No transcription available yet.
              </p>
              <Button>
                Start Transcription
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
