// OpenAI-compatible API provider for AI analysis
// Works with OpenAI, Ollama, LM Studio, and other OpenAI-compatible endpoints

export type OpenAICompatConfig = {
  apiUrl: string      // e.g., https://api.openai.com/v1 or http://localhost:11434/v1
  apiKey?: string     // Optional for local endpoints
  model: string       // e.g., gpt-4o-mini, llama3.2, etc.
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatCompletionResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Call an OpenAI-compatible chat completions endpoint
 */
export async function chatCompletion(
  config: OpenAICompatConfig,
  messages: ChatMessage[],
  options: {
    temperature?: number
    maxTokens?: number
  } = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1024 } = options

  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} ${errorText}`)
  }

  const data: ChatCompletionResponse = await response.json()

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from API')
  }

  return data.choices[0].message.content
}

/**
 * Test connection to an OpenAI-compatible endpoint
 */
export async function testConnection(config: OpenAICompatConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to list models or make a simple completion
    const url = `${config.apiUrl.replace(/\/$/, '')}/models`

    const headers: Record<string, string> = {}
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      // Some endpoints don't support /models, try a simple completion
      await chatCompletion(config, [{ role: 'user', content: 'Hi' }], { maxTokens: 5 })
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Analysis prompts
const ANALYSIS_PROMPTS = {
  summary: `Summarize the following transcript in 2-3 concise sentences. Focus on the main topics and key takeaways.

Transcript:
{transcript}

Summary:`,

  actionItems: `Extract action items from the following transcript. Return ONLY a JSON array of strings, with each string being one action item. If there are no action items, return an empty array [].

Example response: ["Schedule follow-up meeting", "Send report to team", "Review budget proposal"]

Transcript:
{transcript}

Action items (JSON array):`,

  topics: `List the main topics discussed in the following transcript. Return ONLY a JSON array of strings, with each string being one topic (2-4 words each).

Example response: ["Project timeline", "Budget concerns", "Team allocation"]

Transcript:
{transcript}

Topics (JSON array):`,

  keyPoints: `Extract the key points from the following transcript. Return ONLY a JSON array of strings, with each string being one key point.

Example response: ["Project deadline moved to Q2", "New team member joining", "Budget increased by 15%"]

Transcript:
{transcript}

Key points (JSON array):`,

  sentiment: `Analyze the overall sentiment of the following transcript. Return ONLY one word: "positive", "negative", "neutral", or "mixed".

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
  config: OpenAICompatConfig,
  transcript: string,
  analysisType: keyof typeof ANALYSIS_PROMPTS
): Promise<string | string[]> {
  const prompt = ANALYSIS_PROMPTS[analysisType].replace('{transcript}', transcript)

  const response = await chatCompletion(
    config,
    [
      {
        role: 'system',
        content: 'You are a helpful assistant that analyzes transcripts. Be concise and accurate.',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 1024 }
  )

  // Parse JSON arrays for certain types
  if (['actionItems', 'topics', 'keyPoints'].includes(analysisType)) {
    try {
      // Try to extract JSON from response
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
      // Return as array with single item if parsing fails
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
  config: OpenAICompatConfig,
  transcript: string,
  onProgress?: (stage: string) => void
): Promise<AnalysisResult> {
  const result: AnalysisResult = {}

  // Truncate very long transcripts
  const maxLength = 8000
  const truncatedTranscript = transcript.length > maxLength
    ? transcript.slice(0, maxLength) + '...[truncated]'
    : transcript

  onProgress?.('Generating summary...')
  result.summary = (await runAnalysis(config, truncatedTranscript, 'summary')) as string

  onProgress?.('Extracting action items...')
  result.actionItems = (await runAnalysis(config, truncatedTranscript, 'actionItems')) as string[]

  onProgress?.('Identifying topics...')
  result.topics = (await runAnalysis(config, truncatedTranscript, 'topics')) as string[]

  onProgress?.('Extracting key points...')
  result.keyPoints = (await runAnalysis(config, truncatedTranscript, 'keyPoints')) as string[]

  onProgress?.('Analyzing sentiment...')
  const sentiment = (await runAnalysis(config, truncatedTranscript, 'sentiment')) as string
  result.sentiment = sentiment as AnalysisResult['sentiment']

  return result
}
