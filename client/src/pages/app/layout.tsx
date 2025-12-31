import { useEffect, useState } from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { Mic, Folder, LayoutDashboard, Settings, LogOut, Menu, X } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { AdBanner } from '@/components/ads/AdBanner'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isPending && !session) {
      navigate('/login')
    }
  }, [session, isPending, navigate])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location])

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
    <div className="min-h-screen lg:h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 w-full border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold"></h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-accent rounded-lg transition"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop & Mobile */}
      <aside className={cn(
        "w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 ease-in-out",
        "lg:relative lg:translate-x-0 lg:h-screen lg:sticky lg:top-0",
        "fixed inset-y-0 left-0 z-50 h-screen",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-border shrink-0">
          <h1 className="text-xl font-bold hidden lg:block">  Transcriber, I Hardly Knew Her</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {session.user?.name || session.user?.email}
          </p>
          <div className="mt-4">
            <ThemeSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
          <NavLink to="/" icon={<LayoutDashboard size={20} />}>
            Dashboard
          </NavLink>
          <NavLink to="/subjects" icon={<Folder size={20} />}>
            Subjects
          </NavLink>
          <NavLink to="/record" icon={<Mic size={20} />}>
            Record
          </NavLink>
        </nav>

        <div className="p-4 border-t border-border space-y-1 flex-shrink-0">
          <NavLink to="/settings" icon={<Settings size={20} />}>
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

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Fixed Footer Ad Banner - positioned at bottom */}
      <footer className="fixed bottom-0 right-0 left-0 lg:left-64 border-t border-border bg-background p-4 z-30">
        <div className="max-w-full">
          <AdBanner placement="transcription" />
        </div>
      </footer>
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
  const location = useLocation()
  const isActive = location.pathname === to
  
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
        isActive 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
