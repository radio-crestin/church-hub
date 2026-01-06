import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AISearchConfig, AISearchResult } from './types'
import type { SongSearchResult } from '../songs/types'

const ANALYSIS_PROMPT = `You are analyzing search results for a church song database.
Given the user's search intent and a list of song candidates with their content snippets,
score each song's relevance from 0-100 based on how well it matches the search intent.

Consider:
- How well the song title and content relate to the search topic
- Thematic relevance (not just keyword matching)
- Songs about the topic should score higher than songs that just mention keywords

Return ONLY a JSON array with song IDs and scores:
[{"id": 1, "score": 85}, {"id": 2, "score": 72}, ...]

Include ALL songs in your response. Sort by score descending.`

interface ScoredResult {
  id: number
  score: number
}

/**
 * Use AI to analyze and score search results based on relevance to query
 */
export async function analyzeAndScoreResults(
  originalQuery: string,
  candidates: SongSearchResult[],
  config: AISearchConfig,
): Promise<AISearchResult[]> {
  if (candidates.length === 0) return []

  // Prepare candidates summary for AI analysis
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.categoryName || 'Uncategorized',
    content: c.matchedContent?.slice(0, 300) || '',
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

Songs to analyze (${candidates.length} total):
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
      console.log('[AI Search] Reasoning:', reasoning)
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

    const resultsWithScores: AISearchResult[] = candidates.map((c) => ({
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
    console.error('[AI Search] Analysis failed:', error)
    // Fallback: return candidates without AI scores, limited to 100
    return candidates.slice(0, 100).map((c) => ({ ...c, aiRelevanceScore: 50 }))
  }
}
