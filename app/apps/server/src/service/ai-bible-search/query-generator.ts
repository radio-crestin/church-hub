import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIBibleSearchConfig, AIGeneratedTerms } from './types'

const SYSTEM_PROMPT = `You are a Bible verse search term generator. Given a user's search intent, generate 15-25 highly relevant search terms to find matching Bible verses.

Think deeply about what the user is looking for and generate comprehensive terms:

1. DIRECT TERMS: Words directly from the query
2. SYNONYMS: Alternative words with same meaning in biblical context
3. BIBLICAL VOCABULARY: Words used in Scripture (e.g., "love" → "charity", "lovingkindness", "compassion")
4. THEOLOGICAL TERMS: Doctrinal concepts (e.g., "saved" → "salvation", "redemption", "justification", "sanctification")
5. HEBREW/GREEK CONCEPTS: When relevant (e.g., "peace" → "shalom", "rest")
6. CHARACTER NAMES: Biblical figures related to the topic (e.g., "faith" → "Abraham", "Moses", "David")
7. BOOK-SPECIFIC TERMS: Words common in Psalms, Proverbs, Gospels, Epistles
8. ROMANIAN DIACRITICS: Both with and without (e.g., "înălțare", "inaltare", "mântuire", "mantuire")
9. ARCHAIC FORMS: Old Romanian or KJV-style terms still in translations

Rules:
- Generate terms in the SAME LANGUAGE as the input
- Each term should be 1-3 words max
- Focus on words that actually appear in Bible translations
- Consider Old Testament, Psalms, Wisdom literature, Prophets, Gospels, and Epistles
- Include both literal and metaphorical expressions

Examples:
- "verses about hope" → ["hope", "trust", "faith", "promise", "wait", "confidence", "anchor", "expectation", "assurance", "refuge", "strength", "salvation", "deliver", "sustain"]
- "versete despre iertare" → ["iertare", "iartă", "iertat", "păcat", "milă", "har", "răscumpărare", "izbăvire", "curățit", "spălat", "vină", "greșeală", "pocăință"]

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
    prompt: `User is searching for Bible verses about: "${userQuery}"

Think carefully about:
- What biblical themes and concepts relate to this search?
- What words would appear in Scripture about this topic?
- What synonyms, theological terms, and character names should be included?
- What books of the Bible commonly address this topic?`,
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
