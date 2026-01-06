import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIGeneratedTerms, AISearchConfig } from './types'

const SYSTEM_PROMPT = `You are a search term generator for a church song database (Romanian & English).
Given a user's search intent, generate 5-10 relevant search terms.

Rules:
- Generate terms in the same language as the input
- Include synonyms (e.g., "dragoste" → also "iubire")
- Include related concepts (e.g., "hope" → "faith", "trust", "promise")
- Include Romanian diacritics variants (e.g., "înălțare", "inaltare")
- Keep each term short (1-2 words max)
- Focus on words likely to appear in song lyrics

Return JSON only: { "terms": ["term1", "term2", ...] }`

/**
 * Generate search terms from user query using AI
 */
export async function generateSearchTerms(
  userQuery: string,
  config: AISearchConfig,
): Promise<AIGeneratedTerms> {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  })

  const { text } = await generateText({
    model: openai(config.model || 'gpt-5.2'),
    system: SYSTEM_PROMPT,
    prompt: `User is searching for: "${userQuery}"`,
    maxTokens: 300,
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
      },
    },
  })

  // Parse the JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Fallback: return original query as single term
    return { terms: [userQuery] }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (Array.isArray(parsed.terms) && parsed.terms.length > 0) {
      return { terms: parsed.terms }
    }
  } catch {
    // JSON parse failed
  }

  // Fallback: return original query as single term
  return { terms: [userQuery] }
}
