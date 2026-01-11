// AI Analysis orchestration
// Coordinates between different AI providers (OpenAI-compatible, local LLM)

import type { AIProvider, AIProviderConfig, TranscriptionAnalysis, Transcription } from '@shared/types'
import { getAISettings, addAnalysis, getAnalysisByTranscriptionId, updateAnalysis } from './db'
import { runFullAnalysis as runOpenAIAnalysis, testConnection as testOpenAIConnection, type AnalysisResult } from './ai-providers/openai-compat'
import {
  runFullAnalysis as runLocalAnalysis,
  testConnection as testLocalConnection,
  isWebGPUSupported,
  LOCAL_MODELS,
  type ModelDownloadProgress,
} from './ai-providers/local-webllm'

export type AnalysisProgress = {
  status: 'initializing' | 'analyzing' | 'complete' | 'error'
  stage?: string
  progress: number // 0-100
  error?: string
}

/**
 * Get the current AI provider configuration
 */
export async function getAIConfig(): Promise<AIProviderConfig | null> {
  return await getAISettings()
}

/**
 * Check if AI analysis is configured and available
 */
export async function isAIConfigured(): Promise<boolean> {
  const config = await getAISettings()
  if (!config) return false

  if (config.provider === 'openai-compatible') {
    return !!(config.apiUrl && config.model)
  }

  if (config.provider === 'local') {
    return !!config.localModel
  }

  return false
}

/**
 * Test the AI provider connection
 */
export async function testAIConnection(config: AIProviderConfig): Promise<{ success: boolean; error?: string }> {
  if (config.provider === 'openai-compatible') {
    if (!config.apiUrl || !config.model) {
      return { success: false, error: 'API URL and model are required' }
    }
    return await testOpenAIConnection({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
    })
  }

  if (config.provider === 'local') {
    if (!config.localModel) {
      return { success: false, error: 'Local model is required' }
    }
    return await testLocalConnection(config.localModel)
  }

  return { success: false, error: 'Unknown provider' }
}

/**
 * Run AI analysis on a transcription
 */
export async function analyzeTranscription(
  transcription: Transcription,
  userId: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<TranscriptionAnalysis | null> {
  const config = await getAISettings()

  if (!config) {
    onProgress?.({ status: 'error', progress: 0, error: 'AI not configured. Please configure AI settings first.' })
    return null
  }

  onProgress?.({ status: 'initializing', progress: 5, stage: 'Loading AI provider...' })

  try {
    let result: AnalysisResult

    if (config.provider === 'openai-compatible') {
      if (!config.apiUrl || !config.model) {
        throw new Error('OpenAI-compatible provider requires API URL and model')
      }

      result = await runOpenAIAnalysis(
        {
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          model: config.model,
        },
        transcription.text,
        (stage) => {
          onProgress?.({ status: 'analyzing', progress: 30, stage })
        }
      )
    } else if (config.provider === 'local') {
      if (!config.localModel) {
        throw new Error('Local provider requires a model selection')
      }

      result = await runLocalAnalysis(
        config.localModel,
        transcription.text,
        (stage) => {
          onProgress?.({ status: 'analyzing', progress: 30, stage })
        },
        (modelProgress) => {
          // Show model download progress
          if (modelProgress.progress < 100) {
            onProgress?.({
              status: 'initializing',
              progress: Math.round(modelProgress.progress * 0.2), // 0-20% for model loading
              stage: modelProgress.text,
            })
          }
        }
      )
    } else {
      throw new Error('Unknown AI provider')
    }

    onProgress?.({ status: 'analyzing', progress: 90, stage: 'Saving analysis...' })

    // Check if analysis already exists
    const existingAnalysis = await getAnalysisByTranscriptionId(transcription.id)

    if (existingAnalysis) {
      // Update existing analysis
      await updateAnalysis(existingAnalysis.id, {
        summary: result.summary,
        actionItems: result.actionItems,
        topics: result.topics,
        keyPoints: result.keyPoints,
        sentiment: result.sentiment,
        provider: config.provider,
        model: config.provider === 'openai-compatible' ? config.model! : config.localModel!,
        createdAt: new Date(),
      })

      const updated: TranscriptionAnalysis = {
        ...existingAnalysis,
        summary: result.summary,
        actionItems: result.actionItems,
        topics: result.topics,
        keyPoints: result.keyPoints,
        sentiment: result.sentiment,
        provider: config.provider,
        model: config.provider === 'openai-compatible' ? config.model! : config.localModel!,
        createdAt: new Date(),
      }

      onProgress?.({ status: 'complete', progress: 100 })
      return updated
    }

    // Create new analysis
    const analysis: TranscriptionAnalysis = {
      id: crypto.randomUUID(),
      transcriptionId: transcription.id,
      summary: result.summary,
      actionItems: result.actionItems,
      topics: result.topics,
      keyPoints: result.keyPoints,
      sentiment: result.sentiment,
      createdAt: new Date(),
      provider: config.provider,
      model: config.provider === 'openai-compatible' ? config.model! : config.localModel!,
      userId,
    }

    await addAnalysis(analysis)

    onProgress?.({ status: 'complete', progress: 100 })
    return analysis
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({ status: 'error', progress: 0, error: errorMsg })
    throw error
  }
}

/**
 * Get existing analysis for a transcription
 */
export async function getAnalysis(transcriptionId: string): Promise<TranscriptionAnalysis | null> {
  const analysis = await getAnalysisByTranscriptionId(transcriptionId)
  return analysis ?? null
}

// Default configurations for common providers
export const PROVIDER_PRESETS = {
  openai: {
    provider: 'openai-compatible' as AIProvider,
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  ollama: {
    provider: 'openai-compatible' as AIProvider,
    apiUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
  },
  lmstudio: {
    provider: 'openai-compatible' as AIProvider,
    apiUrl: 'http://localhost:1234/v1',
    model: 'local-model',
  },
}

// Re-export local model utilities
export { LOCAL_MODELS, isWebGPUSupported }
export type { ModelDownloadProgress }
