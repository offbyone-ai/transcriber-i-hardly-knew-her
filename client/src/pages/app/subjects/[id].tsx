import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Mic, Trash2, FileText } from 'lucide-react'
import { db, deleteRecording } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Subject, Recording } from '@shared/types'

export default function SubjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSubjectData()
  }, [id])

  async function loadSubjectData() {
    if (!id) return

    setIsLoading(true)
    try {
      // Load subject
      const subjectData = await db.subjects.get(id)
      if (!subjectData) {
        navigate('/subjects')
        return
      }
      setSubject(subjectData)

      // Load recordings for this subject
      const recordingsData = await db.recordings
        .where('subjectId')
        .equals(id)
        .reverse()
        .sortBy('createdAt')
      setRecordings(recordingsData)
    } catch (error) {
      console.error('Failed to load subject:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDeleteRecording(recordingId: string) {
    if (!confirm('Delete this recording and its transcription?')) return

    try {
      await deleteRecording(recordingId)
      await loadSubjectData()
    } catch (error) {
      console.error('Failed to delete recording:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!subject) {
    return null
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link 
            to="/subjects" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft size={16} />
            Back to subjects
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{subject.name}</h1>
              {subject.description && (
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                  {subject.description}
                </p>
              )}
            </div>
            <Link to="/record" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Plus size={20} />
                New Recording
              </Button>
            </Link>
          </div>
        </div>

        {recordings.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center">
            <Mic size={40} className="sm:hidden mx-auto text-muted-foreground mb-4" />
            <Mic size={48} className="hidden sm:block mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">No recordings yet</h2>
            <p className="text-muted-foreground text-xs sm:text-sm mb-6">
              Record audio for this subject to get started with transcription
            </p>
            <Link to="/record">
              <Button className="w-full sm:w-auto">
                <Mic size={20} />
                Start Recording
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {recordings.map((recording) => (
              <Card key={recording.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <Mic size={24} className="text-primary shrink-0 hidden sm:block mt-1" />
                  
                  <div className="flex-1 min-w-0">
                    <Link to={`/recordings/${recording.id}`}>
                      <h3 className="font-semibold text-base sm:text-lg hover:text-primary transition break-words">
                        {recording.title || 'Untitled Recording'}
                      </h3>
                    </Link>
                    
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                      <span>
                        {Math.floor(recording.duration / 60)}:{String(Math.floor(recording.duration % 60)).padStart(2, '0')}
                      </span>
                      <span>
                        {(recording.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <span>
                        {new Date(recording.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Check if transcription exists */}
                    <TranscriptionStatus recordingId={recording.id} />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <Link to={`/recordings/${recording.id}`} className="flex-1 sm:flex-none">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRecording(recording.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TranscriptionStatus({ recordingId }: { recordingId: string }) {
  const [hasTranscription, setHasTranscription] = useState(false)

  useEffect(() => {
    async function checkTranscription() {
      const transcription = await db.transcriptions
        .where('recordingId')
        .equals(recordingId)
        .first()
      setHasTranscription(!!transcription)
    }
    checkTranscription()
  }, [recordingId])

  if (!hasTranscription) return null

  return (
    <div className="flex items-center gap-1 mt-2 text-sm text-primary">
      <FileText size={16} />
      <span>Transcription available</span>
    </div>
  )
}
