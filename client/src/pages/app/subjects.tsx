import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Folder, Trash2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { getSubjectsByUserId, addSubject, deleteSubject } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Subject } from '@shared/types'

export default function SubjectsPage() {
  const { data: session } = useSession()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectDescription, setNewSubjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadSubjects()
  }, [session])

  async function loadSubjects() {
    if (!session?.user?.id) return
    
    setIsLoading(true)
    try {
      const userSubjects = await getSubjectsByUserId(session.user.id)
      setSubjects(userSubjects)
    } catch (error) {
      console.error('Failed to load subjects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user?.id || !newSubjectName.trim()) return

    setIsCreating(true)
    try {
      const newSubject: Subject = {
        id: crypto.randomUUID(),
        userId: session.user.id,
        name: newSubjectName.trim(),
        description: newSubjectDescription.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await addSubject(newSubject)
      await loadSubjects()
      
      // Reset form
      setNewSubjectName('')
      setNewSubjectDescription('')
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to create subject:', error)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteSubject(subjectId: string) {
    if (!confirm('Are you sure? This will delete all recordings and transcriptions in this subject.')) {
      return
    }

    try {
      await deleteSubject(subjectId)
      await loadSubjects()
    } catch (error) {
      console.error('Failed to delete subject:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading subjects...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-muted-foreground mt-2">
              Organize your recordings into subjects
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={20} />
                New Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Subject</DialogTitle>
                <DialogDescription>
                  Add a new subject to organize your recordings
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubject}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="e.g., Meeting Notes, Interviews, Lectures"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      value={newSubjectDescription}
                      onChange={(e) => setNewSubjectDescription(e.target.value)}
                      placeholder="Brief description of this subject"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Subject'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {subjects.length === 0 ? (
          <Card className="p-12 text-center">
            <Folder size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No subjects yet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Create your first subject to organize recordings by topic, project, or category
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus size={20} />
              Create Subject
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.id} className="p-6 hover:border-primary transition">
                <Link to={`/app/subjects/${subject.id}`} className="block">
                  <div className="flex items-start gap-3 mb-3">
                    <Folder className="text-primary flex-shrink-0" size={24} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{subject.name}</h3>
                      {subject.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {subject.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(subject.createdAt).toLocaleDateString()}
                  </div>
                </Link>
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDeleteSubject(subject.id)
                    }}
                    className="w-full text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
