import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIGeneratedTerms, AISearchConfig } from './types'

const SYSTEM_PROMPT = `You are a search term generator for a church song database (Romanian & English).
Given a user's search intent, generate 15-25 highly relevant search terms to maximize finding matching songs.

Think deeply about what the user is looking for and generate comprehensive terms:

1. DIRECT TERMS: Words directly from the query
2. SYNONYMS: Alternative words with same meaning (e.g., "dragoste" → "iubire", "amor")
3. RELATED CONCEPTS: Thematically connected ideas (e.g., "hope" → "faith", "trust", "promise", "anchor", "confidence")
4. BIBLICAL TERMS: Religious vocabulary (e.g., "salvation" → "mântuire", "răscumpărare", "izbăvire")
5. EMOTIONAL EXPRESSIONS: How the theme is expressed in worship (e.g., "praise" → "laudă", "slavă", "adorare", "închinare")
6. ROMANIAN DIACRITICS: Both with and without diacritics (e.g., "înălțare", "inaltare")
7. COMMON PHRASES: Short phrases that appear in songs about this topic

Rules:
- Generate terms in the SAME LANGUAGE as the input
- Each term should be 1-3 words max
- Focus on words that actually appear in worship song lyrics
- Think about hymns, contemporary worship, and traditional church songs
- Include both formal and informal expressions

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
    prompt: `User is searching for songs about: "${userQuery}"

Think carefully about:
- What themes and concepts relate to this search?
- What words would appear in worship songs about this topic?
- What synonyms and related biblical terms should be included?`,
    maxTokens: 600,
    providerOptions: {
      openai: {
        reasoningEffort: 'medium',
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
