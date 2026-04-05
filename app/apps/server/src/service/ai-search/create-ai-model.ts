import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'

interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
}

const DEFAULT_MODELS: Record<AIProviderConfig['provider'], string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.5-flash',
  custom: 'gpt-4o',
}

export function createAiModel(config: AIProviderConfig): LanguageModelV1 {
  const modelId = config.model || DEFAULT_MODELS[config.provider]

  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      })
      return anthropic(modelId)
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      })
      return google(modelId)
    }
    case 'openai':
    case 'custom':
    default: {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      })
      return openai(modelId)
    }
  }
}
