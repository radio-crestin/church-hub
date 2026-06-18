import { createGeminiSession } from './gemini'
import type {
  EngineHandlers,
  EngineSession,
  EngineSessionConfig,
} from './types'

export type { EngineHandlers, EngineSession, EngineSessionConfig }

export async function createEngineSession(
  config: EngineSessionConfig,
  handlers: EngineHandlers,
): Promise<EngineSession> {
  return createGeminiSession(config, handlers)
}
