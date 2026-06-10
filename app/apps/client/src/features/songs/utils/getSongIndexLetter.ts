import { NON_ALPHA_LETTER } from '../constants/alphabet'

// Combining diacritical marks block (U+0300–U+036F). Defined via char codes so
// no combining characters appear in source (keeps linters/editors happy).
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
)

/**
 * Maps a song title to its alphabet-index bucket (A–Z or "#").
 *
 * Diacritics are folded to their base Latin letter via NFD decomposition so
 * Romanian titles group naturally: "Ștefan" → S, "Înalță" → I, "Ave" → A.
 * Titles that do not start with a Latin letter (digits, symbols) fall into the
 * "#" bucket.
 */
export function getSongIndexLetter(title: string): string {
  const trimmed = title.trimStart()
  if (!trimmed) return NON_ALPHA_LETTER

  const first = trimmed
    .charAt(0)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toUpperCase()

  if (first >= 'A' && first <= 'Z') return first
  return NON_ALPHA_LETTER
}
