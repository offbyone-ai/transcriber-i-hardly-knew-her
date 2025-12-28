import { Link } from 'react-router-dom'

export default function MarketingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <h1 className="text-6xl font-bold">Transcriber</h1>
        <p className="text-2xl text-muted-foreground">
          Record, transcribe, and organize your audio - completely offline
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your private transcription assistant powered by AI. All processing happens locally on your device.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/signup"
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="px-8 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Sign In
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="p-6 bg-card rounded-lg border border-border">
            <h3 className="text-xl font-semibold mb-2">🎙️ Local Recording</h3>
            <p className="text-muted-foreground">
              Record audio directly in your browser with no uploads required
            </p>
          </div>
          <div className="p-6 bg-card rounded-lg border border-border">
            <h3 className="text-xl font-semibold mb-2">🗣️ AI Transcription</h3>
            <p className="text-muted-foreground">
              Powered by Whisper AI running entirely on your device
            </p>
          </div>
          <div className="p-6 bg-card rounded-lg border border-border">
            <h3 className="text-xl font-semibold mb-2">📂 Organized</h3>
            <p className="text-muted-foreground">
              Keep your recordings organized by subjects and dates
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
