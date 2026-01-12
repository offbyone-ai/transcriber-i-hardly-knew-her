import { useState, useEffect } from 'react'
import { AlertCircle, Palette, Monitor, Fingerprint, Plus, Trash2, Bot, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { WHISPER_MODELS, type WhisperModel, type AIProviderConfig, type AIProvider } from '@shared/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPreferredModel, setPreferredModel } from '@/lib/model-manager'
import { useTheme, getAvailableThemes, themeModes } from '@/components/theme-provider'
import type { ThemePreset, ThemeMode } from '@/components/theme-provider'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { getAISettings, saveAISettings } from '@/lib/db'
import { testAIConnection, PROVIDER_PRESETS, LOCAL_MODELS, isWebGPUSupported } from '@/lib/ai-analysis'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Cpu, Cloud } from 'lucide-react'

export default function SettingsPage() {
  const [preferredModel, setPreferredModelState] = useState<WhisperModel>(getPreferredModel())
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name?: string; createdAt?: Date }>>([])
  const { preset, mode, setPreset, setMode } = useTheme()
  const availableThemes = getAvailableThemes()

  // AI Settings state
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai-compatible')
  const [aiApiUrl, setAiApiUrl] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiLocalModel, setAiLocalModel] = useState<string>(LOCAL_MODELS[0].id)
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [aiTestError, setAiTestError] = useState<string>('')
  const [modelLoadProgress, setModelLoadProgress] = useState<{ progress: number; text: string } | null>(null)
  const [aiSaving, setAiSaving] = useState(false)
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null)

  async function handleAddPasskey() {
    setPasskeyLoading(true)
    try {
      await authClient.passkey.addPasskey()
      toast.success('Passkey added successfully!')
      // Refresh passkey list
      await loadPasskeys()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add passkey'
      toast.error(message)
      console.error(err)
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function loadPasskeys() {
    try {
      const result = await authClient.passkey.listUserPasskeys()
      if (result.data) {
        setPasskeys(result.data)
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err)
    }
  }

  // Load passkeys on mount
  useEffect(() => {
    loadPasskeys()
  }, [])

  // Load AI settings on mount
  useEffect(() => {
    async function loadAISettings() {
      const config = await getAISettings()
      // Check WebGPU support first
      const supported = await isWebGPUSupported()
      setWebGPUSupported(supported)

      if (config) {
        // If user had local provider saved but WebGPU is now unavailable, switch to API
        if (config.provider === 'local' && !supported) {
          setAiProvider('openai-compatible')
          // Keep other settings in case they switch back
        } else {
          setAiProvider(config.provider)
        }
        setAiApiUrl(config.apiUrl || '')
        setAiApiKey(config.apiKey || '')
        setAiModel(config.model || '')
        setAiLocalModel(config.localModel || LOCAL_MODELS[0].id)
      } else {
        // No config saved - default to API mode if WebGPU unavailable
        if (!supported) {
          setAiProvider('openai-compatible')
        }
      }
    }
    loadAISettings()
  }, [])

  async function handleTestAIConnection() {
    setAiTestStatus('testing')
    setAiTestError('')
    setModelLoadProgress(null)

    const config: AIProviderConfig = {
      provider: aiProvider,
      apiUrl: aiApiUrl,
      apiKey: aiApiKey,
      model: aiModel,
      localModel: aiLocalModel,
    }

    const result = await testAIConnection(config, (progress) => {
      setModelLoadProgress(progress)
    })

    setModelLoadProgress(null)

    if (result.success) {
      setAiTestStatus('success')
    } else {
      setAiTestStatus('error')
      setAiTestError(result.error || 'Connection failed')
    }
  }

  async function handleSaveAISettings() {
    setAiSaving(true)
    try {
      const config: AIProviderConfig = {
        provider: aiProvider,
        apiUrl: aiApiUrl,
        apiKey: aiApiKey,
        model: aiModel,
        localModel: aiLocalModel,
      }
      await saveAISettings(config)
      toast.success('AI settings saved')
    } catch {
      toast.error('Failed to save AI settings')
    } finally {
      setAiSaving(false)
    }
  }

  function handleApplyPreset(presetName: 'openai' | 'ollama' | 'lmstudio') {
    const presetConfig = PROVIDER_PRESETS[presetName]
    setAiProvider(presetConfig.provider)
    setAiApiUrl(presetConfig.apiUrl)
    setAiModel(presetConfig.model)
    if (presetName === 'openai') {
      // Don't clear API key for OpenAI as user needs to provide it
    } else {
      setAiApiKey('') // Local endpoints don't need API key
    }
    setAiTestStatus('idle')
  }

  function handleSetPreferredModel(modelName: WhisperModel) {
    setPreferredModel(modelName)
    setPreferredModelState(modelName)
  }

  function handleSetPreset(newPreset: ThemePreset) {
    setPreset(newPreset)
  }

  function handleSetMode(newMode: ThemeMode) {
    setMode(newMode)
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Manage your transcription and appearance preferences
          </p>
        </div>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette size={20} className="text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>
              Customize how the application looks with different themes and color modes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Preset Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Theme Preset</h3>
              <div className="grid grid-cols-1 gap-3">
                {availableThemes.map((themePreset) => {
                  const isSelected = preset === themePreset.value
                  
                  return (
                    <label
                      key={themePreset.value}
                      className={`flex items-start gap-3 p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme-preset"
                        checked={isSelected}
                        onChange={() => handleSetPreset(themePreset.value)}
                        className="mt-0.5 w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {themePreset.seasonal?.emoji && (
                            <span className="text-lg">{themePreset.seasonal.emoji}</span>
                          )}
                          <span className="font-semibold text-sm">{themePreset.label}</span>
                          {isSelected && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {themePreset.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Light/Dark Mode Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold">Color Mode</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {themeModes.map((themeMode) => {
                  const isSelected = mode === themeMode.value
                  
                  return (
                    <button
                      key={themeMode.value}
                      onClick={() => handleSetMode(themeMode.value)}
                      className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg border transition-colors text-xs sm:text-sm font-medium ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {themeMode.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose between light and dark mode, or follow your system preference
              </p>
            </div>

            {/* Theme Preview Info */}
            <div className="p-3 sm:p-4 bg-accent rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Preview:</strong> Theme changes apply instantly. Each theme preset has unique colors for both light and dark modes.
                  </p>
                  <p>
                    <strong>Tip:</strong> Try different combinations to find your perfect look!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passkey Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Fingerprint size={20} className="text-primary" />
              <CardTitle>Passkeys</CardTitle>
            </div>
            <CardDescription>
              Manage your passkeys for faster, passwordless sign-in using biometrics or security keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {passkeys.length > 0 ? (
                passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{passkey.name || 'Unnamed Passkey'}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await authClient.passkey.deletePasskey({ id: passkey.id })
                          toast.success('Passkey removed')
                          await loadPasskeys()
                        } catch (err) {
                          const message = err instanceof Error ? err.message : 'Failed to remove passkey'
                          toast.error(message)
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No passkeys configured yet
                </div>
              )}
            </div>

            <Button
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              className="w-full"
            >
              {passkeyLoading ? (
                'Adding Passkey...'
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Passkey
                </>
              )}
            </Button>

            <div className="p-3 bg-accent rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>What are passkeys?</strong> Passkeys use biometrics (Face ID, Touch ID, Windows Hello) or security keys to sign you in instantly without passwords or magic links.
                  </p>
                  <p>
                    <strong>Tip:</strong> Add a passkey on each device you use for the fastest sign-in experience.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-primary" />
              <CardTitle>AI Analysis</CardTitle>
            </div>
            <CardDescription>
              Configure AI-powered analysis for your transcriptions. Extract summaries, action items, topics, and key points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Type Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Provider Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setAiProvider('local')
                    setAiTestStatus('idle')
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                    aiProvider === 'local'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  } ${webGPUSupported === false ? 'opacity-60' : ''}`}
                >
                  <Cpu size={18} />
                  <div className="text-left">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      In-Browser
                      {webGPUSupported === false && (
                        <XCircle size={12} className="text-red-500" />
                      )}
                    </div>
                    <div className="text-xs opacity-70">
                      {webGPUSupported === false ? 'WebGPU unavailable' : 'Uses WebGPU'}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setAiProvider('openai-compatible')
                    setAiTestStatus('idle')
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                    aiProvider === 'openai-compatible'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <Cloud size={18} />
                  <div className="text-left">
                    <div className="text-sm font-medium">API</div>
                    <div className="text-xs opacity-70">OpenAI-compatible</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Local Provider Configuration */}
            {aiProvider === 'local' && (
              <div className="space-y-4">
                {webGPUSupported === false && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
                    <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                      <XCircle size={18} className="mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium">WebGPU is not supported in this browser</p>
                        <p className="text-red-600 dark:text-red-400">
                          In-browser AI requires WebGPU, which is not available in Safari, Firefox, or older browsers.
                        </p>
                      </div>
                    </div>
                    <div className="ml-6 space-y-2">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">Options:</p>
                      <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                        <li>Use <strong>Chrome</strong> or <strong>Edge</strong> browser for in-browser AI</li>
                        <li>Switch to <strong>API mode</strong> below for cloud or local server AI</li>
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiProvider('openai-compatible')
                          handleApplyPreset('ollama')
                        }}
                        className="mt-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
                      >
                        <Cloud size={14} className="mr-2" />
                        Switch to API Mode (Ollama)
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Select Model</Label>
                  {LOCAL_MODELS.map((model) => {
                    const isSelected = aiLocalModel === model.id
                    return (
                      <label
                        key={model.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="local-model"
                          checked={isSelected}
                          onChange={() => {
                            setAiLocalModel(model.id)
                            setAiTestStatus('idle')
                          }}
                          className="mt-0.5 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{model.name}</span>
                            <span className="text-xs text-muted-foreground">{model.size}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {model.description}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <div className="p-3 bg-accent rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <strong>Privacy:</strong> Models run entirely in your browser. Your data never leaves your device.
                      </p>
                      <p>
                        <strong>First use:</strong> The model will be downloaded and cached (may take a few minutes).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OpenAI-Compatible Provider Configuration */}
            {aiProvider === 'openai-compatible' && (
              <>
                {/* Quick Setup Presets */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Quick Setup</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset('ollama')}
                      className="text-xs"
                    >
                      Ollama
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset('lmstudio')}
                      className="text-xs"
                    >
                      LM Studio
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset('openai')}
                      className="text-xs"
                    >
                      OpenAI
                    </Button>
                  </div>
                </div>

                {/* Provider Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-api-url">API URL</Label>
                    <Input
                      id="ai-api-url"
                      placeholder="https://api.openai.com/v1"
                      value={aiApiUrl}
                      onChange={(e) => {
                        setAiApiUrl(e.target.value)
                        setAiTestStatus('idle')
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      OpenAI-compatible endpoint (e.g., http://localhost:11434/v1 for Ollama)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-api-key">API Key (optional for local)</Label>
                    <Input
                      id="ai-api-key"
                      type="password"
                      placeholder="sk-..."
                      value={aiApiKey}
                      onChange={(e) => {
                        setAiApiKey(e.target.value)
                        setAiTestStatus('idle')
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for OpenAI, optional for local endpoints like Ollama
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-model">Model Name</Label>
                    <Input
                      id="ai-model"
                      placeholder="gpt-4o-mini"
                      value={aiModel}
                      onChange={(e) => {
                        setAiModel(e.target.value)
                        setAiTestStatus('idle')
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: gpt-4o-mini, llama3.2, mistral, phi3
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Test & Save */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestAIConnection}
                  disabled={
                    aiTestStatus === 'testing' ||
                    (aiProvider === 'openai-compatible' && (!aiApiUrl || !aiModel)) ||
                    (aiProvider === 'local' && !aiLocalModel)
                  }
                  className="flex-1"
                >
                  {aiTestStatus === 'testing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {aiProvider === 'local' ? 'Loading Model...' : 'Testing...'}
                    </>
                  ) : (
                    aiProvider === 'local' ? 'Test Model' : 'Test Connection'
                  )}
                </Button>
                <Button
                  onClick={handleSaveAISettings}
                  disabled={
                    aiSaving ||
                    (aiProvider === 'openai-compatible' && (!aiApiUrl || !aiModel)) ||
                    (aiProvider === 'local' && !aiLocalModel)
                  }
                  className="flex-1"
                >
                  {aiSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
              </div>

              {/* Model Loading Progress */}
              {aiTestStatus === 'testing' && aiProvider === 'local' && modelLoadProgress && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      {modelLoadProgress.progress < 100 ? 'Downloading Model...' : 'Loading Model...'}
                    </span>
                    <span className="text-purple-600 dark:text-purple-400">{modelLoadProgress.progress}%</span>
                  </div>
                  <div className="h-2 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${modelLoadProgress.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 truncate">
                    {modelLoadProgress.text}
                  </p>
                </div>
              )}

              {/* Test Status */}
              {aiTestStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle size={16} />
                  {aiProvider === 'local' ? 'Model loaded successfully!' : 'Connection successful!'}
                </div>
              )}
              {aiTestStatus === 'error' && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{aiTestError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Whisper Model Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Whisper Model Selection</CardTitle>
            <CardDescription>
              Choose which model to use for transcription. Models are automatically downloaded from HuggingFace on first use and cached in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {(Object.keys(WHISPER_MODELS) as WhisperModel[]).map((modelName) => {
              const modelInfo = WHISPER_MODELS[modelName]
              const isPreferred = preferredModel === modelName

              return (
                <label
                  key={modelName}
                  className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors ${
                    isPreferred 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    checked={isPreferred}
                    onChange={() => handleSetPreferredModel(modelName)}
                    className="w-4 h-4 mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base">{modelName}</h3>
                      {isPreferred && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {modelInfo.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Download size: ~{(modelInfo.size / 1024 / 1024).toFixed(0)} MB (downloaded on first use)
                    </p>
                  </div>
                </label>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>
                <strong>First use:</strong> When you transcribe audio with a new model, it will download automatically (1-2 minutes depending on size and connection).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>
                <strong>Subsequent uses:</strong> Models are cached in your browser, so transcription starts instantly.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>
                <strong>Offline-first:</strong> Once downloaded, models work completely offline. Your audio never leaves your device.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-15 sm:min-w-20">tiny.en</span>
                <span>Fastest processing, good for quick transcriptions and testing. Lower accuracy.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-15 sm:min-w-20">base.en</span>
                <span>Best balance of speed and accuracy. Recommended for most users.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-15 sm:min-w-20">small.en</span>
                <span>Highest accuracy, slower processing. Best for important transcriptions.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
