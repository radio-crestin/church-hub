/** The words of one full-text index, sorted, with how many documents hold each. */
export interface Vocabulary {
  terms: string[]
  docCounts: number[]
  documentCount: number
}

/** One way a typed word may appear in a document. */
export interface TermVariant {
  /** The word, or its pieces separated by spaces ("s a" for "s-a"). */
  text: string
  /** Matches every word that starts with `text` (the word still being typed). */
  prefix: boolean
  /** Typos between what was typed and this variant: 0, 1 or 2. */
  edits: number
}

/** A typed word and every variant that counts as finding it. */
export interface TermGroup {
  typed: string
  variants: TermVariant[]
  /** The pieces of a word typed with a sign ("s-a" → ["s", "a"]), else []. */
  pieces: string[]
  /** How much finding this word says about a match: rarer words weigh more. */
  weight: number
  /**
   * Whether a document must hold the word to be a candidate. A single letter
   * or a two-letter beginning still being typed matches too much to look
   * up; it only counts in the scoring.
   */
  required: boolean
}

/** How well one text matches the query, see `scoreTextMatch`. */
export interface TextMatchScore {
  /** 0–100: 100 is every word, untouched, as one phrase. */
  score: number
  /** True when every word that carries meaning (2+ letters) was found. */
  allFound: boolean
  /** Position of the first word of the longest in-order phrase found. */
  phraseStart: number
  /** The words of the text that matched a looked-up word (folded), to mark. */
  matchedForms: string[]
}
