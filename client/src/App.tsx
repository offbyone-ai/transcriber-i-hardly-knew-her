import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import './index.css'

// Import pages (we'll create these)
import MarketingPage from './pages/marketing'
import LoginPage from './pages/login'
import SignupPage from './pages/signup'
import AppLayout from './pages/app/layout'
import DashboardPage from './pages/app/dashboard'
import SubjectsPage from './pages/app/subjects'
import SubjectDetailPage from './pages/app/subjects/[id]'
import RecordingDetailPage from './pages/app/recordings/[id]'
import RecordPage from './pages/app/record'
import SettingsPage from './pages/app/settings'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MarketingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/app',
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
    ],
  },
])

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="transcriber-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
