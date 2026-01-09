import { createContext, useContext, useState, type ReactNode } from 'react'
import { AlertDialog } from './ui/alert-dialog'

interface AlertOptions {
  title: string
  description: string
  actionLabel?: string
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertOptions | null>(null)

  const showAlert = (options: AlertOptions) => {
    setAlertState(options)
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alertState && (
        <AlertDialog
          open={true}
          onOpenChange={() => setAlertState(null)}
          title={alertState.title}
          description={alertState.description}
          actionLabel={alertState.actionLabel}
        />
      )}
    </AlertContext.Provider>
  )
}
