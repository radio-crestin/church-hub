import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIBibleSearchConfig, AIBibleSearchResult } from './types'
import type { BibleSearchResult } from '../bible/types'

const ANALYSIS_PROMPT = `You are analyzing Bible verse search results.
Given the user's search intent and a list of verse candidates with their text,
score each verse's relevance from 0-100 based on how well it matches the search intent.

Consider:
- How directly the verse addresses the topic (central theme vs passing mention)
- Thematic relevance (not just keyword matching)
- Verses that are commonly cited for this topic should score higher
- Famous verses on the topic (e.g., John 3:16 for salvation) should score very high
- Context matters: a verse about "love" in 1 Corinthians 13 is more relevant for "what is love" than a passing mention

Return ONLY a JSON array with verse IDs and scores:
[{"id": 1, "score": 95}, {"id": 2, "score": 78}, ...]

Include ALL verses in your response. Sort by score descending.`

interface ScoredResult {
  id: number
  score: number
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

  // Prepare candidates summary for AI analysis
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    reference: c.reference,
    book: c.bookName,
    text: c.text.slice(0, 250),
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

Verses to analyze (${candidates.length} total):
${JSON.stringify(candidatesSummary, null, 2)}`,
      maxTokens: 4000,
      providerOptions: {
        openai: {
          reasoningEffort: 'medium',
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
