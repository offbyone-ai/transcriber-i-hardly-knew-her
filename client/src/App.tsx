import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import { AlertProvider } from './components/alert-provider'
import { ErrorBoundary } from './components/error-boundary'
import { PWAUpdatePrompt } from './components/pwa-update-prompt'
import { Toaster } from './components/ui/sonner'
import './index.css'

// Check if running in Tauri native app
const isTauri = '__TAURI__' in window

// Import pages
import LoginPage from './pages/login.tsx'
import SignupPage from './pages/signup.tsx'
import AppLayout from './pages/app/layout.tsx'
import DashboardPage from './pages/app/dashboard.tsx'
import SubjectsPage from './pages/app/subjects.tsx'
import SubjectDetailPage from './pages/app/subjects/[id].tsx'
import RecordingDetailPage from './pages/app/recordings/[id].tsx'
import RecordPage from './pages/app/record.tsx'
import SettingsPage from './pages/app/settings.tsx'
import FeedbackPage from './pages/app/feedback.tsx'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'subjects',
        element: <SubjectsPage />,
      },
      {
        path: 'subjects/:id',
        element: <SubjectDetailPage />,
      },
      {
        path: 'recordings/:id',
        element: <RecordingDetailPage />,
      },
      {
        path: 'record',
        element: <RecordPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'feedback',
        element: <FeedbackPage />,
      },
    ],
  },
], {
  // Use /app for web, / for Tauri native app
  basename: isTauri ? '/' : '/app',
})

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultMode="system" defaultPreset="default" modeStorageKey="transcriber-theme-mode" presetStorageKey="transcriber-theme-preset">
        <AlertProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
          {!isTauri && <PWAUpdatePrompt />}
        </AlertProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
