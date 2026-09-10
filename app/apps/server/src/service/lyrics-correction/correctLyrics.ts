import { generateText } from 'ai'

import { parseCorrectedLines } from './parseCorrectedLines'
import { getAISearchConfig } from '../ai-search/config'
import { createAiModel } from '../ai-search/create-ai-model'

/**
 * Proof-reads a passage of lyrics.
 *
 * The job is correction, never rewriting: missing Romanian diacritics, obvious
 * misspellings, capitalisation, and the proper names a hymn refers to. The line
 * structure is what the projector lays out, so it has to come back exactly as
 * it went in — the model is told so, and the answer is checked for it before it
 * is handed on.
 *
 * Runs on the same provider and key the AI song search already uses; there is
 * no second thing to configure.
 */
const SYSTEM_PROMPT = `You proof-read Romanian (and occasionally English) worship song lyrics.

Correct ONLY what is objectively wrong:
- restore missing Romanian diacritics (ă â î ș ț) — "canta" -> "cântă", "Dumnezeu" stays "Dumnezeu"
- fix obvious spelling mistakes and typos
- fix capitalisation, including proper names (Isus, Hristos, Dumnezeu, Duhul Sfânt, Ierusalim, David)
- fix obviously wrong punctuation

Never do any of this:
- do NOT rewrite, rephrase, modernise or "improve" the poetry
- do NOT add, remove, reorder, merge or split lines
- do NOT translate
- do NOT add or remove words unless the word is plainly misspelled
- do NOT change text that is already correct

The input has exactly N lines. Your answer must have exactly the same N lines, in
the same order, each line corresponding to the input line at the same position.
An empty input line stays an empty output line.

Return JSON only, no prose, no code fence:
{ "lines": ["corrected line 1", "corrected line 2", ...] }`

export interface LyricsCorrectionResult {
  text: string
  /** True when the model actually changed something. */
  changed: boolean
}

export async function correctLyrics(
  text: string,
): Promise<LyricsCorrectionResult> {
  const config = getAISearchConfig()
  // Raised early rather than answered with the original text: an operator who
  // pressed "correct" is owed the reason nothing happened.
  if (!config?.apiKey) {
    throw new Error('AI is not configured')
  }

  const lines = text.split('\n')
  const model = createAiModel(config)

  const { text: answer } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: `The passage has ${lines.length} line(s):\n\n${JSON.stringify(
      { lines },
      null,
      2,
    )}`,
    maxTokens: Math.min(4000, 200 + text.length * 2),
  })

  const corrected = parseCorrectedLines(answer, lines.length)
  if (!corrected) throw new Error('AI returned an unusable correction')

  const next = corrected.join('\n')
  return { text: next, changed: next !== text }
}
