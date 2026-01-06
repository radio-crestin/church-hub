import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AISearchConfig, AISearchResult } from './types'
import type { SongSearchResult } from '../songs/types'

const ANALYSIS_PROMPT = `You are analyzing search results for a church song database.
Given the user's search intent and a list of song candidates with their lyrics content,
score each song's relevance from 0-100 based on how well it matches the search intent.

SCORING CRITERIA:
- 90-100: Song is DIRECTLY about this topic (central theme of the entire song)
- 70-89: Song has a MAJOR section about this topic (verse or chorus dedicated to it)
- 50-69: Song MENTIONS the topic meaningfully (relevant lines but not main theme)
- 30-49: Song has TANGENTIAL connection (related concepts but not the topic itself)
- 0-29: Song has MINIMAL or NO relevance (only superficial keyword match)

IMPORTANT:
- Read the actual lyrics content provided, not just the title
- A song titled "Love" but with lyrics about something else should score low for "love" searches
- Songs that express the searched concept through metaphor or different words can score high
- Consider the overall message and theme, not just keyword presence

For EACH song, you MUST provide a brief reason explaining your score.

Return JSON array:
[{"id": 1, "score": 85, "reason": "Entire chorus about God's love"}, {"id": 2, "score": 45, "reason": "Mentions hope once but mainly about praise"}, ...]

Include ALL songs. Sort by score descending.`

interface ScoredResult {
  id: number
  score: number
  reason?: string
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

  // Prepare candidates summary for AI analysis - include more content for better scoring
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.categoryName || 'Uncategorized',
    lyrics: c.matchedContent?.slice(0, 800) || '',
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

Analyze each song's lyrics content and determine how relevant it is to the search query.
Focus on the ACTUAL CONTENT, not just the title.

Songs to analyze (${candidates.length} total):
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
