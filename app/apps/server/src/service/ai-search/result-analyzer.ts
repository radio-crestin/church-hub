import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AISearchConfig, AISearchResult } from './types'
import type { SongSearchResult } from '../songs/types'

const ANALYSIS_PROMPT = `You are analyzing search results for a church song database.
Given the user's search intent and matching lyrics from each song candidate,
score each song's relevance from 0-100 based on how well it matches the search intent.

SCORING CRITERIA:
- 90-100: Song is DIRECTLY about this topic (the matching lyrics show it's a central theme)
- 70-89: Song has STRONG content on this topic (dedicated verse/chorus about it)
- 50-69: Song MENTIONS the topic meaningfully (relevant lines in context)
- 30-49: Song has WEAK connection (related concepts but not the searched topic)
- 0-29: Song has MINIMAL relevance (keyword appears but song is about something else)

IMPORTANT:
- The "matchingLyrics" field shows ONLY the lines that matched the search query
- Judge based on how these lyrics relate to what the user is searching for
- Consider if the lyrics directly express the searched concept or just mention a word
- A song with many matching lines about the topic should score higher

For EACH song, provide a brief reason (max 10 words) explaining your score.

Return JSON array:
[{"id": 1, "score": 85, "reason": "Chorus directly about God's love"}, {"id": 2, "score": 35, "reason": "Word appears but song about praise"}]

Include ALL songs. Sort by score descending.`

interface ScoredResult {
  id: number
  score: number
  reason?: string
}

/**
 * Extract only the lines from content that contain words from the original query
 * This filters out noise from AI-generated terms and focuses on relevant matches
 */
function extractRelevantLines(content: string, originalQuery: string): string {
  if (!content || !originalQuery) return ''

  // Extract query words (normalize: lowercase, remove diacritics for matching)
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const queryWords = originalQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => normalizeText(w))

  if (queryWords.length === 0) return content.slice(0, 300)

  // Split content into lines and filter to those containing query words
  const lines = content.split(/\n|<br\s*\/?>/i).filter((line) => line.trim())

  const relevantLines = lines.filter((line) => {
    const normalizedLine = normalizeText(line)
    return queryWords.some((word) => normalizedLine.includes(word))
  })

  // Return relevant lines, or first few lines if no matches
  if (relevantLines.length > 0) {
    return relevantLines.slice(0, 8).join('\n') // Max 8 relevant lines
  }

  // Fallback: return first 3 lines if no direct matches
  return lines.slice(0, 3).join('\n')
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

  // Prepare candidates summary - only include lyrics that match original query
  const candidatesSummary = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.categoryName || 'Uncategorized',
    matchingLyrics: extractRelevantLines(c.matchedContent || '', originalQuery),
  }))

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  })

  try {
    const { text, reasoning } = await generateText({
      model: openai(config.model || 'gpt-5.2'),
      system: ANALYSIS_PROMPT,
      prompt: `User is searching for: "${originalQuery}"

Score each song based on how well its matching lyrics relate to this search.

Songs (${candidates.length} total):
${JSON.stringify(candidatesSummary, null, 2)}`,
      maxTokens: 5000,
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
