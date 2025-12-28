import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { WHISPER_MODELS, type WhisperModel } from '@shared/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPreferredModel, setPreferredModel } from '@/lib/model-manager'

export default function SettingsPage() {
  const [preferredModel, setPreferredModelState] = useState<WhisperModel>(getPreferredModel())

  function handleSetPreferred(modelName: WhisperModel) {
    setPreferredModel(modelName)
    setPreferredModelState(modelName)
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your transcription preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Whisper Model Selection</CardTitle>
            <CardDescription>
              Choose which model to use for transcription. Models are automatically downloaded from HuggingFace on first use and cached in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(WHISPER_MODELS) as WhisperModel[]).map((modelName) => {
              const modelInfo = WHISPER_MODELS[modelName]
              const isPreferred = preferredModel === modelName

              return (
                <label
                  key={modelName}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    isPreferred 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="radio"
                      name="model"
                      checked={isPreferred}
                      onChange={() => handleSetPreferred(modelName)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{modelName}</h3>
                        {isPreferred && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {modelInfo.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Download size: ~{(modelInfo.size / 1024 / 1024).toFixed(0)} MB (downloaded on first use)
                      </p>
                    </div>
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
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>
                <strong>First use:</strong> When you transcribe audio with a new model, it will download automatically (1-2 minutes depending on size and connection).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>
                <strong>Subsequent uses:</strong> Models are cached in your browser, so transcription starts instantly.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
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
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[80px]">tiny.en</span>
                <span>Fastest processing, good for quick transcriptions and testing. Lower accuracy.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[80px]">base.en</span>
                <span>Best balance of speed and accuracy. Recommended for most users.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[80px]">small.en</span>
                <span>Highest accuracy, slower processing. Best for important transcriptions.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
