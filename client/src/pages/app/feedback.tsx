import { useState } from 'react'
import { MessageSquarePlus, ExternalLink, Bug, Lightbulb, MessageCircle, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// GitHub repository for issues
const GITHUB_REPO = 'offbyone-ai/transcriber-i-hardly-knew-her'

type FeedbackType = 'bug' | 'feature' | 'general'

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'bug',
    label: 'Bug Report',
    icon: <Bug size={18} />,
    description: 'Something isn\'t working as expected',
  },
  {
    value: 'feature',
    label: 'Feature Request',
    icon: <Lightbulb size={18} />,
    description: 'Suggest an improvement or new feature',
  },
  {
    value: 'general',
    label: 'General Feedback',
    icon: <MessageCircle size={18} />,
    description: 'Share your thoughts or ask a question',
  },
]

function getSystemInfo(): string {
  const info: string[] = []

  // Browser info
  const userAgent = navigator.userAgent
  let browser = 'Unknown'
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome'
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari'
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge'
  }
  info.push(`**Browser:** ${browser}`)

  // Platform
  const platform = navigator.platform || 'Unknown'
  info.push(`**Platform:** ${platform}`)

  // Screen resolution
  info.push(`**Screen:** ${window.screen.width}x${window.screen.height}`)

  // Viewport size
  info.push(`**Viewport:** ${window.innerWidth}x${window.innerHeight}`)

  // Language
  info.push(`**Language:** ${navigator.language}`)

  // Online status
  info.push(`**Online:** ${navigator.onLine ? 'Yes' : 'No'}`)

  // Touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  info.push(`**Touch Support:** ${hasTouch ? 'Yes' : 'No'}`)

  // WebGPU support
  const hasWebGPU = 'gpu' in navigator
  info.push(`**WebGPU:** ${hasWebGPU ? 'Available' : 'Not available'}`)

  return info.join('\n')
}

function generateGitHubIssueUrl(
  type: FeedbackType,
  title: string,
  description: string,
  includeSystemInfo: boolean
): string {
  const labels = {
    bug: 'bug',
    feature: 'enhancement',
    general: 'feedback',
  }

  const typeLabel = FEEDBACK_TYPES.find(t => t.value === type)?.label || 'Feedback'

  let body = `## Description\n\n${description || '_No description provided_'}`

  if (includeSystemInfo) {
    body += `\n\n## System Information\n\n${getSystemInfo()}`
  }

  body += `\n\n---\n_Submitted via in-app feedback form_`

  const params = new URLSearchParams({
    title: title || `[${typeLabel}] `,
    body,
    labels: labels[type],
  })

  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`
}

export default function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = generateGitHubIssueUrl(feedbackType, title, description, includeSystemInfo)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const typeLabel = FEEDBACK_TYPES.find(t => t.value === feedbackType)?.label || 'Feedback'

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Send Feedback</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Help us improve Transcriber by sharing your feedback or reporting issues
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={20} className="text-primary" />
              <CardTitle>Submit Feedback</CardTitle>
            </div>
            <CardDescription>
              Your feedback will open a pre-filled GitHub issue. You'll need a GitHub account to submit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Feedback Type Selection */}
              <div className="space-y-3">
                <Label>What type of feedback?</Label>
                <div className="grid gap-2">
                  {FEEDBACK_TYPES.map((type) => {
                    const isSelected = feedbackType === type.value
                    return (
                      <label
                        key={type.value}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="feedback-type"
                          checked={isSelected}
                          onChange={() => setFeedbackType(type.value)}
                          className="mt-0.5 w-4 h-4 shrink-0"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                            {type.icon}
                          </span>
                          <div>
                            <span className="font-medium text-sm">{type.label}</span>
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder={`Brief summary of your ${typeLabel.toLowerCase()}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  placeholder={
                    feedbackType === 'bug'
                      ? 'Please describe what happened, what you expected, and steps to reproduce...'
                      : feedbackType === 'feature'
                      ? 'Describe the feature you\'d like to see and how it would help you...'
                      : 'Share your thoughts, suggestions, or questions...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                />
              </div>

              {/* System Info Toggle */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSystemInfo}
                    onChange={(e) => setIncludeSystemInfo(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Include system information</span>
                    <p className="text-xs text-muted-foreground">
                      Helps us diagnose issues by including browser, platform, and screen info
                    </p>
                  </div>
                </label>

                {/* System Info Preview */}
                {includeSystemInfo && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      System info that will be included:
                    </p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {getSystemInfo().replace(/\*\*/g, '')}
                    </pre>
                  </div>
                )}
              </div>

              {/* Privacy Note */}
              <div className="p-3 bg-accent rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong>How it works:</strong> Clicking submit will open GitHub with your feedback pre-filled. You can review and edit before submitting.
                    </p>
                    <p>
                      <strong>Privacy:</strong> No data is sent until you click "Submit new issue" on GitHub. System info is optional and visible before submission.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open GitHub to Submit
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Alternative Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other Ways to Reach Us</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              You can also browse existing issues or start a discussion on our{' '}
              <a
                href={`https://github.com/${GITHUB_REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
