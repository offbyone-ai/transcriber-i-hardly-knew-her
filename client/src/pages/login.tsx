import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handlePasskeySignIn() {
    setError('')
    setPasskeyLoading(true)

    try {
      await authClient.signIn.passkey()
      navigate('/app')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with passkey')
      console.error(err)
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authClient.signIn.magicLink({
        email,
        callbackURL: '/app',
      })
      
      setEmailSent(true)
      
      // In development, check if there's a magic link to show
      if (import.meta.env.DEV) {
        setTimeout(async () => {
          try {
            const response = await fetch(`/api/dev/magic-link/${encodeURIComponent(email)}`)
            if (response.ok) {
              const data = await response.json()
              if (data.url) {
                toast.success('Development Magic Link', {
                  description: 'Click to sign in instantly',
                  action: {
                    label: 'Sign In',
                    onClick: () => window.location.href = data.url
                  },
                  duration: 300000, // 5 minutes
                })
              }
            }
          } catch (e) {
            // Silently fail - not critical
          }
        }, 500)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send sign-in link')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                We've sent a sign-in link to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Next steps:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open the email we just sent you</li>
                  <li>Click the sign-in link</li>
                  <li>Start transcribing!</li>
                </ol>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Note:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The link expires in 5 minutes</li>
                  <li>Check your spam folder if you don't see it</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button 
                onClick={() => setEmailSent(false)} 
                variant="outline" 
                className="w-full"
              >
                Send Another Link
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in with your email - no password needed
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>We'll send you a secure sign-in link</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                💡 <strong>Passwordless & secure:</strong> We'll email you a magic link to sign in safely.
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="button" 
                onClick={handlePasskeySignIn} 
                disabled={passkeyLoading}
                className="w-full"
                variant="default"
              >
                {passkeyLoading ? (
                  'Authenticating...'
                ) : (
                  <>
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Sign In with Passkey
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <Button type="submit" disabled={loading} variant="outline" className="w-full">
                {loading ? 'Sending...' : 'Send Sign-In Link'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                New to Transcriber?{' '}
                <Link to="/signup" className="text-primary hover:underline">
                  Create an account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
