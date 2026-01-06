import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

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
      setError(err.message || 'Failed to send sign-up link')
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
                  <li>Click the link to create your account</li>
                  <li>Start transcribing!</li>
                </ol>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Note:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The link expires in 5 minutes</li>
                  <li>Your account will be created automatically</li>
                  <li>Check spam folder if you don't see the email</li>
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
          <h1 className="text-4xl font-bold">Get started</h1>
          <p className="text-muted-foreground mt-2">
            Create your account - no password required
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Enter your email to create your account
            </CardDescription>
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
                💡 <strong>Passwordless signup:</strong> We'll email you a link to create your account. No password needed!
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Create Account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
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
