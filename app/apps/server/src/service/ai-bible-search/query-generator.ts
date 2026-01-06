import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIBibleSearchConfig, AIGeneratedTerms } from './types'

const SYSTEM_PROMPT = `You are a Bible verse search term generator. Given a user's search intent, generate 8-15 relevant search terms to find matching Bible verses.

Rules:
- Generate terms in the same language as the input (Romanian or English)
- Include key biblical concepts and themes (e.g., "love" → "charity", "grace", "mercy", "compassion")
- Include synonyms and related words (e.g., "forgiveness" → "pardon", "remit", "sin", "transgression")
- Include biblical terminology (e.g., "saved" → "salvation", "redeemed", "delivered", "eternal life")
- Include character names when relevant (e.g., "shepherd" → "David", "Jesus", "pastor")
- For Romanian: include diacritics variants (e.g., "înălțare", "inaltare", "învierea", "invierea")
- For Romanian: include common biblical terms (har, mântuire, iertare, credință, speranță, dragoste)
- Keep each term short (1-3 words max)
- Focus on words that appear in Bible verses, not modern expressions
- Think about the context: Old Testament prophecies, Psalms, Gospels, Epistles

Examples:
- "verses about hope" → ["hope", "trust", "faith", "promise", "wait", "confidence", "anchor", "expectation"]
- "versete despre iertare" → ["iertare", "iartă", "păcat", "milă", "har", "răscumpărare", "izbăvire"]
- "Jesus miracles" → ["miracle", "heal", "sight", "blind", "lame", "leprosy", "dead", "raised", "loaves", "fish"]

Return JSON only: { "terms": ["term1", "term2", ...] }`

/**
 * Generate search terms from user query using AI
 * Optimized for Bible verse search
 */
export async function generateBibleSearchTerms(
  userQuery: string,
  config: AIBibleSearchConfig,
): Promise<AIGeneratedTerms> {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  })

  const { text } = await generateText({
    model: openai(config.model || 'gpt-5.2'),
    system: SYSTEM_PROMPT,
    prompt: `User is searching for Bible verses about: "${userQuery}"`,
    maxTokens: 400,
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
