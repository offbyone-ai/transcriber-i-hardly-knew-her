import { useState, useEffect } from 'react'
import { Cloud, HardDrive, Shield, AlertTriangle, Info, Zap, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  getServerTranscriptionStatus, 
  type UsageInfo, 
  type TranscriptionStatusResponse 
} from '@/lib/server-transcription'
import { 
  isMobileDevice, 
  canUseLocalTranscription, 
  getWebGPUInfo,
  type TranscriptionMode 
} from '@/lib/device-detection'

type WebGPUStatus = {
  available: boolean
  adapterName?: string
  vendor?: string
}

type TranscriptionModePickerProps = {
  selectedMode: TranscriptionMode
  onModeChange: (mode: TranscriptionMode) => void
  className?: string
}

export function TranscriptionModePicker({ 
  selectedMode, 
  onModeChange,
  className = '' 
}: TranscriptionModePickerProps) {
  const [serverStatus, setServerStatus] = useState<TranscriptionStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [webGPUStatus, setWebGPUStatus] = useState<WebGPUStatus | null>(null)
  
  const isMobile = isMobileDevice()
  const canUseLocal = canUseLocalTranscription()
  
  useEffect(() => {
    // Fetch server status and WebGPU info in parallel
    Promise.all([
      getServerTranscriptionStatus(),
      getWebGPUInfo()
    ]).then(([status, gpuInfo]) => {
      setServerStatus(status)
      setWebGPUStatus(gpuInfo)
    }).finally(() => setLoading(false))
  }, [])
  
  const serverAvailable = serverStatus?.ready ?? false
  const usage = serverStatus?.usage
  const freeTierLimit = serverStatus?.freeTierLimit ?? 3
  
  if (loading) {
    return (
      <div className={`animate-pulse bg-muted rounded-lg h-24 ${className}`} />
    )
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Shield className="w-4 h-4" />
        <span>Transcription Mode</span>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Local Mode */}
        <button
          onClick={() => canUseLocal && onModeChange('local')}
          disabled={!canUseLocal}
          className={`
            relative p-4 rounded-lg border-2 text-left transition-all
            ${selectedMode === 'local' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
            }
            ${!canUseLocal ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg
              ${selectedMode === 'local' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
            `}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2 flex-wrap">
                Local (Browser)
                <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded">
                  Private
                </span>
                {webGPUStatus && (
                  <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    webGPUStatus.available 
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {webGPUStatus.available ? (
                      <>
                        <Zap className="w-3 h-3" />
                        WebGPU
                      </>
                    ) : (
                      <>
                        <Cpu className="w-3 h-3" />
                        CPU
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                AI runs 100% in your browser. Nothing uploaded.
              </p>
              {!canUseLocal && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {isMobile ? 'Requires WebGPU (not available)' : 'Browser not supported'}
                </p>
              )}
            </div>
          </div>
          {selectedMode === 'local' && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
        
        {/* Server Mode */}
        <button
          onClick={() => serverAvailable && usage && usage.remaining > 0 && onModeChange('server')}
          disabled={!serverAvailable || (usage?.remaining ?? 0) <= 0}
          className={`
            relative p-4 rounded-lg border-2 text-left transition-all
            ${selectedMode === 'server' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
            }
            ${!serverAvailable || (usage?.remaining ?? 0) <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg
              ${selectedMode === 'server' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
            `}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                Server
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                  Fast
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Processed on our server, then immediately deleted.
              </p>
              {serverAvailable && usage && (
                <p className="text-xs text-muted-foreground mt-2">
                  {usage.remaining} of {freeTierLimit} free uses remaining
                </p>
              )}
              {!serverAvailable && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  Server unavailable
                </p>
              )}
            </div>
          </div>
          {selectedMode === 'server' && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
      
      {/* Privacy note */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-muted-foreground">
          {selectedMode === 'local' ? (
            <span>
              <strong className="text-foreground">Maximum privacy:</strong> Your audio never leaves your device. 
              All processing happens in your browser using {webGPUStatus?.available ? (
                <span className="text-purple-600 dark:text-purple-400 font-medium">WebGPU acceleration</span>
              ) : (
                'WebAssembly'
              )}.
              {webGPUStatus?.available && webGPUStatus.adapterName && (
                <span className="block text-xs mt-1 text-purple-600/70 dark:text-purple-400/70">
                  Using: {webGPUStatus.adapterName}
                </span>
              )}
            </span>
          ) : selectedMode === 'server' ? (
            <span>
              <strong className="text-foreground">Privacy-first:</strong> Your audio is processed and immediately discarded. 
              We don't store any recordings or transcriptions—only a usage counter.
            </span>
          ) : (
            <span>
              <strong className="text-foreground">Browser speech:</strong> Uses your browser's built-in speech recognition. 
              Privacy depends on your browser vendor.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

type UsageMeterProps = {
  usage: UsageInfo
  className?: string
}

export function UsageMeter({ usage, className = '' }: UsageMeterProps) {
  const percentage = (usage.used / usage.limit) * 100
  const resetsAt = new Date(usage.resetsAt)
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Server transcriptions</span>
        <span className="font-medium">
          {usage.used} / {usage.limit} used
        </span>
      </div>
      
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${
            percentage >= 100 
              ? 'bg-red-500' 
              : percentage >= 66 
                ? 'bg-yellow-500' 
                : 'bg-primary'
          }`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      
      <p className="text-xs text-muted-foreground">
        Resets {resetsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
      </p>
    </div>
  )
}

type MobileWarningProps = {
  onDismiss?: () => void
  hasWebGPU?: boolean
  className?: string
}

export function MobileTranscriptionWarning({ onDismiss, hasWebGPU = false, className = '' }: MobileWarningProps) {
  if (!isMobileDevice()) return null
  
  // If mobile has WebGPU, show a positive message instead
  if (hasWebGPU) {
    return (
      <div className={`bg-purple-500/10 border border-purple-500/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-purple-600 dark:text-purple-400">
              GPU acceleration available
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Your device supports WebGPU! Local transcription should work well.
            </p>
            {onDismiss && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDismiss}
                className="mt-2 -ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-700"
              >
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-yellow-600 dark:text-yellow-400">
            Local transcription unavailable
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Your device doesn't support WebGPU. Try using server transcription 
            or the live speech recognition feature instead.
          </p>
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDismiss}
              className="mt-2 -ml-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700"
            >
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
