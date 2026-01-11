// Local LLM provider using WebLLM for in-browser inference
// Runs entirely on the user's device using WebGPU

import * as webllm from '@mlc-ai/web-llm'

export type LocalLLMConfig = {
  model: string  // e.g., 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
}

export type ModelDownloadProgress = {
  progress: number  // 0-100
  text: string
}

// Available models for local inference (smaller models suitable for browser)
export const LOCAL_MODELS = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B',
    size: '~700MB',
    description: 'Fast, good for basic tasks',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    size: '~1.8GB',
    description: 'Better quality, slower',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini',
    size: '~2GB',
    description: 'Microsoft model, good reasoning',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B',
    size: '~900MB',
    description: 'Alibaba model, multilingual',
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 1.7B',
    size: '~1GB',
    description: 'HuggingFace model, efficient',
  },
] as const

export type LocalModelId = typeof LOCAL_MODELS[number]['id']

// Singleton engine instance
let engineInstance: webllm.MLCEngineInterface | null = null
let currentModelId: string | null = null

/**
 * Check if WebGPU is supported in this browser
 */
export async function isWebGPUSupported(): Promise<boolean> {
  if (!navigator.gpu) {
    return false
  }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

/**
 * Get or create the WebLLM engine
 */
export async function getEngine(
  modelId: string,
  onProgress?: (progress: ModelDownloadProgress) => void
): Promise<webllm.MLCEngineInterface> {
  // If we already have an engine with the same model, return it
  if (engineInstance && currentModelId === modelId) {
    return engineInstance
  }

  // If we have an engine with a different model, unload it first
  if (engineInstance && currentModelId !== modelId) {
    await engineInstance.unload()
    engineInstance = null
    currentModelId = null
  }

  // Create new engine with progress callback
  const initProgressCallback = (progress: webllm.InitProgressReport) => {
    onProgress?.({
      progress: Math.round(progress.progress * 100),
      text: progress.text,
    })
  }

  engineInstance = await webllm.CreateMLCEngine(modelId, {
    initProgressCallback,
  })
  currentModelId = modelId

  return engineInstance
}

/**
 * Unload the current model to free memory
 */
export async function unloadModel(): Promise<void> {
  if (engineInstance) {
    await engineInstance.unload()
    engineInstance = null
    currentModelId = null
  }
}

/**
 * Check if a model is currently loaded
 */
export function isModelLoaded(modelId?: string): boolean {
  if (!engineInstance) return false
  if (modelId) return currentModelId === modelId
  return true
}

/**
 * Get the currently loaded model ID
 */
export function getCurrentModelId(): string | null {
  return currentModelId
}

/**
 * Run a chat completion using the local model
 */
export async function chatCompletion(
  modelId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    temperature?: number
    maxTokens?: number
    onProgress?: (progress: ModelDownloadProgress) => void
  } = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1024, onProgress } = options

  const engine = await getEngine(modelId, onProgress)

  const response = await engine.chat.completions.create({
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from local model')
  }

  return content
}

/**
 * Test if the local model can be loaded
 */
export async function testConnection(
  modelId: string,
  onProgress?: (progress: ModelDownloadProgress) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check WebGPU support first
    const webgpuSupported = await isWebGPUSupported()
    if (!webgpuSupported) {
      return {
        success: false,
        error: 'WebGPU is not supported in this browser. Try Chrome, Edge, or a browser with WebGPU support.',
      }
    }

    // Try to load the model
    await getEngine(modelId, onProgress)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load local model',
    }
  }
}

// Analysis prompts (same as OpenAI provider but optimized for smaller models)
const ANALYSIS_PROMPTS = {
  summary: `Summarize this transcript in 2-3 sentences. Be concise.

Transcript:
{transcript}

Summary:`,

  actionItems: `List action items from this transcript as a JSON array. Only include clear action items.
Return format: ["action 1", "action 2"]
If none, return: []

Transcript:
{transcript}

Action items:`,

  topics: `List main topics from this transcript as a JSON array. Use 2-4 words per topic.
Return format: ["topic 1", "topic 2"]

Transcript:
{transcript}

Topics:`,

  keyPoints: `List key points from this transcript as a JSON array.
Return format: ["point 1", "point 2"]

Transcript:
{transcript}

Key points:`,

  sentiment: `What is the overall sentiment? Reply with exactly one word: positive, negative, neutral, or mixed.

Transcript:
{transcript}

Sentiment:`,
}

export type AnalysisResult = {
  summary?: string
  actionItems?: string[]
  topics?: string[]
  keyPoints?: string[]
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
}

/**
 * Run a specific analysis on a transcript
 */
export async function runAnalysis(
  modelId: string,
  transcript: string,
  analysisType: keyof typeof ANALYSIS_PROMPTS,
  onProgress?: (progress: ModelDownloadProgress) => void
): Promise<string | string[]> {
  const prompt = ANALYSIS_PROMPTS[analysisType].replace('{transcript}', transcript)

  const response = await chatCompletion(
    modelId,
    [
      {
        role: 'system',
        content: 'You are a helpful assistant. Be concise and accurate.',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 512, onProgress }
  )

  // Parse JSON arrays for certain types
  if (['actionItems', 'topics', 'keyPoints'].includes(analysisType)) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      // Fallback: split by newlines/bullets
      return response
        .split(/[\n•\-\d.]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
    } catch {
      return [response.trim()]
    }
  }

  // For sentiment, normalize the response
  if (analysisType === 'sentiment') {
    const normalized = response.toLowerCase().trim()
    if (normalized.includes('positive')) return 'positive'
    if (normalized.includes('negative')) return 'negative'
    if (normalized.includes('mixed')) return 'mixed'
    return 'neutral'
  }

  return response.trim()
}

/**
 * Run all analyses on a transcript
 */
export async function runFullAnalysis(
  modelId: string,
  transcript: string,
  onProgress?: (stage: string) => void,
  onModelProgress?: (progress: ModelDownloadProgress) => void
): Promise<AnalysisResult> {
  const result: AnalysisResult = {}

  // Truncate very long transcripts (smaller models have less context)
  const maxLength = 4000
  const truncatedTranscript = transcript.length > maxLength
    ? transcript.slice(0, maxLength) + '...[truncated]'
    : transcript

  onProgress?.('Loading model...')
  // Ensure model is loaded first
  await getEngine(modelId, onModelProgress)

  onProgress?.('Generating summary...')
  result.summary = (await runAnalysis(modelId, truncatedTranscript, 'summary')) as string

  onProgress?.('Extracting action items...')
  result.actionItems = (await runAnalysis(modelId, truncatedTranscript, 'actionItems')) as string[]

  onProgress?.('Identifying topics...')
  result.topics = (await runAnalysis(modelId, truncatedTranscript, 'topics')) as string[]

  onProgress?.('Extracting key points...')
  result.keyPoints = (await runAnalysis(modelId, truncatedTranscript, 'keyPoints')) as string[]

  onProgress?.('Analyzing sentiment...')
  const sentiment = (await runAnalysis(modelId, truncatedTranscript, 'sentiment')) as string
  result.sentiment = sentiment as AnalysisResult['sentiment']

  return result
}
