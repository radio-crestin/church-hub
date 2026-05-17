import type { TranslationEngine } from '../types'
import { createGeminiSession } from './gemini'
import { createOpenAISession } from './openai'
import type { EngineHandlers, EngineSession, EngineSessionConfig } from './types'

export type { EngineSession, EngineHandlers, EngineSessionConfig }

export async function createEngineSession(
  config: EngineSessionConfig,
  handlers: EngineHandlers,
): Promise<EngineSession> {
  if (config.engine === 'gemini') {
    return createGeminiSession(config, handlers)
  }
  return createOpenAISession(config, handlers)
}

export function defaultVoiceForEngine(engine: TranslationEngine): string {
  return engine === 'gemini' ? 'Kore' : 'alloy'
}

export const GEMINI_VOICES = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
  'Zephyr',
] as const

export const OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
] as const
