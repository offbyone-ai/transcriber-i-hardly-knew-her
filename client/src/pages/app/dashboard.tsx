import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { db } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Folder, Mic, FileText, ArrowRight } from 'lucide-react'
import type { Subject, Recording } from '@shared/types'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState({
    subjects: 0,
    recordings: 0,
    transcriptions: 0,
  })
  const [recentSubjects, setRecentSubjects] = useState<Subject[]>([])
  const [recentRecordings, setRecentRecordings] = useState<Recording[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [session])

  async function loadDashboardData() {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      // Get counts
      const subjectsCount = await db.subjects.where('userId').equals(session.user.id).count()
      const recordingsCount = await db.recordings.where('userId').equals(session.user.id).count()
      const transcriptionsCount = await db.transcriptions.where('userId').equals(session.user.id).count()

      setStats({
        subjects: subjectsCount,
        recordings: recordingsCount,
        transcriptions: transcriptionsCount,
      })

      // Get recent items
      const subjects = await db.subjects
        .where('userId')
        .equals(session.user.id)
        .reverse()
        .sortBy('createdAt')
      setRecentSubjects(subjects.slice(0, 3))

      const recordings = await db.recordings
        .where('userId')
        .equals(session.user.id)
        .reverse()
        .sortBy('createdAt')
      setRecentRecordings(recordings.slice(0, 5))
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Your transcription overview
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 sm:gap-3">
            <Link to="/record">
              <Button className="gap-2">
                <Mic size={18} />
                <span className="hidden sm:inline">New Recording</span>
                <span className="sm:hidden">Record</span>
              </Button>
            </Link>
            <Link to="/subjects">
              <Button variant="outline" className="gap-2">
                <Folder size={18} />
                <span className="hidden sm:inline">Subjects</span>
                <span className="sm:hidden">Subjects</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <Link to="/subjects">
            <StatCard
              label="Total Subjects"
              value={stats.subjects.toString()}
              description="Organized collections"
              icon={<Folder size={24} />}
              clickable
            />
          </Link>
          <Link to="/record">
            <StatCard
              label="Total Recordings"
              value={stats.recordings.toString()}
              description="Audio files stored"
              icon={<Mic size={24} />}
              clickable
            />
          </Link>
          <StatCard
            label="Total Transcriptions"
            value={stats.transcriptions.toString()}
            description="Completed transcripts"
            icon={<FileText size={24} />}
          />
        </div>

        {/* Recent Subjects */}
        {recentSubjects.length > 0 && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Recent Subjects</h2>
              <Link to="/subjects">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <div className="space-y-2">
              {recentSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  to={`/subjects/${subject.id}`}
                  className="block p-3 rounded-lg hover:bg-accent transition"
                >
                  <div className="flex items-start gap-3">
                    <Folder size={20} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{subject.name}</div>
                      {subject.description && (
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">
                          {subject.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(subject.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Recordings */}
        {recentRecordings.length > 0 && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Recent Recordings</h2>
            </div>
            <div className="space-y-2">
              {recentRecordings.map((recording) => (
                <Link
                  key={recording.id}
                  to={`/recordings/${recording.id}`}
                  className="block p-3 rounded-lg hover:bg-accent transition"
                >
                  <div className="flex items-start gap-3">
                    <Mic size={20} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{recording.title || 'Untitled Recording'}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {Math.floor(recording.duration / 60)}:{String(Math.floor(recording.duration % 60)).padStart(2, '0')} • {(recording.fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(recording.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Empty state */}
        {stats.subjects === 0 && stats.recordings === 0 && (
          <Card className="p-8 sm:p-12 text-center">
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Get Started</h2>
            <p className="text-muted-foreground text-xs sm:text-sm mb-6">
              Create your first subject or start recording to begin transcribing
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link to="/subjects" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Folder size={20} />
                  Create Subject
                </Button>
              </Link>
              <Link to="/record" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Mic size={20} />
                  Start Recording
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  description,
  icon,
  clickable = false,
}: { 
  label: string
  value: string
  description: string
  icon: React.ReactNode
  clickable?: boolean
}) {
  return (
    <Card className={`p-4 sm:p-6 transition-colors ${clickable ? 'hover:bg-accent cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{value}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {description}
            {clickable && <ArrowRight size={12} className="opacity-50" />}
          </div>
        </div>
        <div className="text-muted-foreground shrink-0 ml-2">{icon}</div>
      </div>
    </Card>
  )
}
