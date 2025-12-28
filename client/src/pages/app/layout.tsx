import { useEffect } from 'react'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { Mic, Folder, LayoutDashboard, Settings, LogOut } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'

export default function AppLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !session) {
      navigate('/login')
    }
  }, [session, isPending, navigate])

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold">Transcriber</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {session.user?.name || session.user?.email}
          </p>
          <div className="mt-4">
            <ThemeSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/app" icon={<LayoutDashboard size={20} />}>
            Dashboard
          </NavLink>
          <NavLink to="/app/subjects" icon={<Folder size={20} />}>
            Subjects
          </NavLink>
          <NavLink to="/app/record" icon={<Mic size={20} />}>
            Record
          </NavLink>
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <NavLink to="/app/settings" icon={<Settings size={20} />}>
            Settings
          </NavLink>
          <button
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ 
  to, 
  icon, 
  children 
}: { 
  to: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
    >
      {icon}
      {children}
    </Link>
  )
}
