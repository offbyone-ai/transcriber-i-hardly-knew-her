import  { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'

interface Props {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo, resetError: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    })

    // You could also log to an error reporting service here
    // e.g., Sentry, LogRocket, etc.
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.errorInfo!,
          this.resetError
        )
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-xl">Something went wrong</CardTitle>
                  <CardDescription>
                    The application encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error message */}
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-destructive mb-2">
                  Error Details:
                </h3>
                <p className="text-sm text-destructive/90 font-mono break-all">
                  {this.state.error.message || 'Unknown error'}
                </p>
              </div>

              {/* Helpful suggestions */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">What you can try:</h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Refresh the page to try again</li>
                  <li>Clear your browser cache and reload</li>
                  <li>Check your internet connection</li>
                  <li>Try signing out and signing back in</li>
                </ul>
              </div>

              {/* Stack trace (collapsible, only in development) */}
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                    Show technical details (for developers)
                  </summary>
                  <div className="bg-muted rounded-lg p-3 overflow-auto max-h-64">
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {this.state.error.stack}
                      {'\n\n'}
                      Component Stack:
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button onClick={this.resetError} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/app')}
                className="flex-1"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
