import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIBibleSearchConfig, AIBibleSearchResult } from './types'
import type { BibleSearchResult } from '../bible/types'

const ANALYSIS_PROMPT = `You are analyzing Bible verse search results.
Given the user's search intent and a list of verse candidates with their full text,
score each verse's relevance from 0-100 based on how well it matches the search intent.

SCORING CRITERIA:
- 90-100: Verse is a KEY PASSAGE on this topic (famous/foundational verse on the subject)
- 70-89: Verse DIRECTLY addresses the topic (clear teaching or statement about it)
- 50-69: Verse is RELATED to the topic (discusses connected concepts)
- 30-49: Verse has INDIRECT connection (metaphorical or contextual relevance)
- 0-29: Verse has MINIMAL relevance (superficial keyword match only)

IMPORTANT:
- Read the actual verse text provided, not just the reference
- Consider theological depth and how directly the verse teaches on the topic
- Famous passages (John 3:16 for salvation, 1 Cor 13 for love, Psalm 23 for comfort) should score high when relevant
- A verse mentioning a word doesn't mean it's about that topic
- Consider the verse's context and primary message

For EACH verse, you MUST provide a brief reason explaining your score.

Return JSON array:
[{"id": 1, "score": 95, "reason": "Key verse defining God's love for the world"}, {"id": 2, "score": 40, "reason": "Mentions faith but primarily about works"}, ...]

Include ALL verses. Sort by score descending.`

interface ScoredResult {
  id: number
  score: number
  reason?: string
}

/**
 * Use AI to analyze and score Bible search results based on relevance to query
 */
export async function analyzeBibleResults(
  originalQuery: string,
  candidates: BibleSearchResult[],
  config: AIBibleSearchConfig,
): Promise<AIBibleSearchResult[]> {
  if (candidates.length === 0) return []

  // Prepare candidates summary for AI analysis - include full verse text
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    reference: c.reference,
    book: c.bookName,
    verseText: c.text, // Full verse text for proper analysis
  }))

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  })

  try {
    const { text, reasoning } = await generateText({
      model: openai(config.model || 'gpt-5.2'),
      system: ANALYSIS_PROMPT,
      prompt: `Search query: "${originalQuery}"

Analyze each verse's text and determine how relevant it is to the search query.
Focus on the ACTUAL VERSE CONTENT and its theological meaning.

Verses to analyze (${candidates.length} total):
${JSON.stringify(candidatesSummary, null, 2)}`,
      maxTokens: 6000,
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
        },
      },
    })

    // Log reasoning if available (for debugging)
    if (reasoning) {
      // biome-ignore lint/suspicious/noConsole: debugging AI reasoning
      console.log('[AI Bible Search] Reasoning:', reasoning)
    }

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      // Fallback: return candidates without AI scores
      return candidates.map((c) => ({ ...c, aiRelevanceScore: 50 }))
    }

    const scored: ScoredResult[] = JSON.parse(jsonMatch[0])

    // Map scores back to candidates
    const scoreMap = new Map(scored.map((s) => [s.id, s.score]))

    const resultsWithScores: AIBibleSearchResult[] = candidates.map((c) => ({
      ...c,
      aiRelevanceScore: scoreMap.get(c.id) ?? 50,
    }))

    // Sort by AI score descending
    resultsWithScores.sort(
      (a, b) => (b.aiRelevanceScore ?? 0) - (a.aiRelevanceScore ?? 0),
    )

    // Return top 100 results
    return resultsWithScores.slice(0, 100)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: error logging
    console.error('[AI Bible Search] Analysis failed:', error)
    // Fallback: return candidates without AI scores, limited to 100
    return candidates.slice(0, 100).map((c) => ({ ...c, aiRelevanceScore: 50 }))
  }
}
