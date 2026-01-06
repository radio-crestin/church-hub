import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AIBibleSearchConfig, AIBibleSearchResult } from './types'
import type { BibleSearchResult } from '../bible/types'

const ANALYSIS_PROMPT = `You are analyzing Bible verse search results.
Given the user's search intent and verse text, score each verse's relevance from 0-100.

SCORING CRITERIA:
- 90-100: KEY PASSAGE on this topic (famous/foundational verse directly about the subject)
- 70-89: DIRECTLY addresses the topic (clear teaching or statement)
- 50-69: RELATED to the topic (discusses connected concepts)
- 30-49: INDIRECT connection (word appears but verse is about something else)
- 0-29: MINIMAL relevance (superficial keyword match)

IMPORTANT:
- Read the actual verse text, not just the reference
- A verse mentioning a word doesn't mean it's ABOUT that topic
- Famous passages should score high when relevant (John 3:16 for salvation, 1 Cor 13 for love)
- Consider what the verse is primarily teaching

For EACH verse, provide a brief reason (max 10 words) explaining your score.

Return JSON array:
[{"id": 1, "score": 95, "reason": "Key verse on God's love for world"}, {"id": 2, "score": 35, "reason": "Word appears but verse about works"}]

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

  // Prepare candidates - compact format with verse text
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    ref: c.reference,
    text: c.text,
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
