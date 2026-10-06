import { decodeHtmlEntities } from '../../text-search/text/decodeHtmlEntities'

/**
 * Romanian function-word + filler vocabulary stripped before computing
 * title/lyrics overlap. The list is intentionally conservative — we only
 * drop words that recur across nearly every hymn ("doamne", "iisus" are
 * deliberately KEPT because they DO carry signal between hymn variants of
 * the same prayer, just less than a distinctive noun like "rusalii"). The
 * goal is to suppress filler like "să / și / nu / mai" that previously
 * inflated bigram similarity on titles like "Doamne mai vreau X" vs
 * "Doamne nu mai vreau Y".
 *
 * Entries are in ASCII form (post-fold), matching `tokenize()`.
 */
const RO_STOPWORDS: ReadonlySet<string> = new Set([
  // Articles & determiners
  'o',
  'un',
  'una',
  'unei',
  'unui',
  'unele',
  'unii',
  'niste',
  'cel',
  'cea',
  'cei',
  'cele',
  'asta',
  'asa',
  'aceea',
  'acela',
  'acesta',
  'aceasta',
  'acesti',
  'aceste',
  // Prepositions
  'in',
  'la',
  'cu',
  'de',
  'pe',
  'din',
  'pana',
  'spre',
  'sub',
  'fara',
  'pentru',
  'peste',
  'catre',
  'prin',
  'intre',
  // Conjunctions / connectives
  'si',
  'sau',
  'dar',
  'iar',
  'ori',
  'nici',
  'ca',
  'sa',
  'caci',
  'deci',
  // Personal pronouns (full and clitic, ASCII-folded)
  'eu',
  'tu',
  'el',
  'ea',
  'noi',
  'voi',
  'ei',
  'ele',
  'ma',
  'te',
  'se',
  'ne',
  'va',
  'mi',
  'ti',
  'ii',
  'le',
  'mie',
  'tie',
  'sie',
  'mine',
  'tine',
  'sine',
  // Possessives + their connective particles
  'meu',
  'mea',
  'mei',
  'mele',
  'tau',
  'ta',
  'tai',
  'tale',
  'sau',
  'sa',
  'sai',
  'sale',
  'al',
  'ai',
  'ale',
  'isi',
  // Auxiliaries / be-forms
  'a',
  'am',
  'ai',
  'au',
  'as',
  'ar',
  'aveti',
  'avem',
  'va',
  'vor',
  'voi',
  'e',
  'esti',
  'este',
  'sunt',
  'era',
  'eram',
  'erau',
  'fi',
  'fie',
  'fii',
  'fost',
  // Negation & modal/quantifier fillers
  'nu',
  'mai',
  'doar',
  'tot',
  'toata',
  'toti',
  'toate',
  'cam',
  'chiar',
  // Interrogatives — rarely the distinctive word of a hymn
  'ce',
  'cum',
  'cand',
  'unde',
  'cine',
  'care',
])

/**
 * Lowercase + NFD strip diacritics + cedilla→comma legacy fold +
 * non-alphanumeric → space + collapse whitespace. This matches what the
 * Romanian hymn corpus needs to be compared apples-to-apples regardless of
 * whether the typist used diacritics, old vs new Unicode for ț/ș, or extra
 * punctuation.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ţş]/g, (m) => (m === 'ţ' ? 't' : 's'))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(s: string): string[] {
  const n = normalize(s)
  if (!n) return []
  return n.split(' ').filter((t) => t.length > 0)
}

/**
 * Drops stopwords + single-character noise from a token list. Returns the
 * content-word set used for the precision-tight Jaccard pass.
 */
export function contentWords(toks: readonly string[]): Set<string> {
  const set = new Set<string>()
  for (const t of toks) {
    if (t.length < 2) continue
    if (RO_STOPWORDS.has(t)) continue
    set.add(t)
  }
  return set
}

/** The words of slide HTML as a reader sees them: tags and entities gone. */
export function lyricsTokens(html: string): string[] {
  return tokenize(decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')))
}
