import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

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

// Given explicitly: left out, the SDKs take ANTHROPIC_BASE_URL, OPENAI_BASE_URL
// and the like from the machine's environment, and the app's AI would go
// wherever another tool on that machine points it.
const DEFAULT_BASE_URLS: Record<AIProviderConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  custom: 'https://api.openai.com/v1',
}

export function createAiModel(config: AIProviderConfig): LanguageModel {
  const modelId = config.model || DEFAULT_MODELS[config.provider]
  const baseURL =
    config.baseUrl ||
    DEFAULT_BASE_URLS[config.provider] ||
    DEFAULT_BASE_URLS.openai

  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL,
      })
      return anthropic(modelId)
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL,
      })
      return google(modelId)
    }
    case 'openai':
    case 'custom':
    default: {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL,
      })
      // Chat Completions, not the Responses API @ai-sdk/openai 2 defaults
      // to: OpenAI-compatible servers behind "custom" only speak this one.
      return openai.chat(modelId)
    }
  }
}
