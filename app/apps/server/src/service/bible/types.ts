/**
 * Bible service types
 * Database records use snake_case, API responses use camelCase
 */

// ============================================================================
// Database Record Types (snake_case)
// ============================================================================

export interface BibleTranslationRecord {
  id: number
  name: string
  abbreviation: string
  language: string
  source_filename: string | null
  created_at: number
  updated_at: number
}

export interface BibleBookRecord {
  id: number
  translation_id: number
  book_code: string
  book_name: string
  book_order: number
  chapter_count: number
  created_at: number
}

export interface BibleVerseRecord {
  id: number
  translation_id: number
  book_id: number
  chapter: number
  verse: number
  text: string
  created_at: number
}

// ============================================================================
// API Response Types (camelCase)
// ============================================================================

export interface BibleTranslation {
  id: number
  name: string
  abbreviation: string
  language: string
  sourceFilename: string | null
  bookCount: number
  verseCount: number
  createdAt: number
  updatedAt: number
}

export interface BibleBook {
  id: number
  translationId: number
  bookCode: string
  bookName: string
  bookOrder: number
  chapterCount: number
}

export interface BibleVerse {
  id: number
  translationId: number
  bookId: number
  bookCode: string
  bookName: string
  chapter: number
  verse: number
  text: string
}

export interface BibleSearchResult {
  id: number
  translationId: number
  bookId: number
  bookName: string
  bookCode: string
  chapter: number
  verse: number
  text: string
  reference: string
  highlightedText: string
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateTranslationInput {
  name: string
  abbreviation: string
  language: string
  xmlContent: string
}

export interface GetVersesInput {
  translationId: number
  bookCode: string
  chapter: number
  startVerse?: number
  endVerse?: number
}

export interface SearchVersesInput {
  query: string
  translationId?: number
  limit?: number
}

// ============================================================================
// Operation Result Types
// ============================================================================

export interface OperationResult {
  success: boolean
  error?: string
}

export interface ImportResult {
  success: boolean
  translation?: BibleTranslation
  error?: string
  booksImported?: number
  versesImported?: number
}

// ============================================================================
// Parsed Types (for XML parsing)
// ============================================================================

export interface ParsedBook {
  bookCode: string
  bookName: string
  bookOrder: number
  chapters: ParsedChapter[]
}

export interface ParsedChapter {
  chapter: number
  verses: ParsedVerse[]
}

export interface ParsedVerse {
  verse: number
  text: string
}

export interface ParsedBible {
  books: ParsedBook[]
}

// ============================================================================
// Book Code Mapping
// ============================================================================

export const BOOK_ORDER: Record<string, number> = {
  // Old Testament
  GEN: 1,
  EXO: 2,
  LEV: 3,
  NUM: 4,
  DEU: 5,
  JOS: 6,
  JDG: 7,
  RUT: 8,
  '1SA': 9,
  '2SA': 10,
  '1KI': 11,
  '2KI': 12,
  '1CH': 13,
  '2CH': 14,
  EZR: 15,
  NEH: 16,
  EST: 17,
  JOB: 18,
  PSA: 19,
  PRO: 20,
  ECC: 21,
  SNG: 22,
  ISA: 23,
  JER: 24,
  LAM: 25,
  EZK: 26,
  DAN: 27,
  HOS: 28,
  JOL: 29,
  AMO: 30,
  OBA: 31,
  JON: 32,
  MIC: 33,
  NAM: 34,
  HAB: 35,
  ZEP: 36,
  HAG: 37,
  ZEC: 38,
  MAL: 39,
  // New Testament
  MAT: 40,
  MRK: 41,
  LUK: 42,
  JHN: 43,
  ACT: 44,
  ROM: 45,
  '1CO': 46,
  '2CO': 47,
  GAL: 48,
  EPH: 49,
  PHP: 50,
  COL: 51,
  '1TH': 52,
  '2TH': 53,
  '1TI': 54,
  '2TI': 55,
  TIT: 56,
  PHM: 57,
  HEB: 58,
  JAS: 59,
  '1PE': 60,
  '2PE': 61,
  '1JN': 62,
  '2JN': 63,
  '3JN': 64,
  JUD: 65,
  REV: 66,
}

// Romanian book name aliases for reference parsing
export const BOOK_ALIASES: Record<string, string> = {
  // Romanian names -> book codes
  geneza: 'GEN',
  gen: 'GEN',
  exodul: 'EXO',
  exod: 'EXO',
  ex: 'EXO',
  leviticul: 'LEV',
  levitic: 'LEV',
  lev: 'LEV',
  numeri: 'NUM',
  num: 'NUM',
  deuteronomul: 'DEU',
  deuteronom: 'DEU',
  deut: 'DEU',
  iosua: 'JOS',
  jos: 'JOS',
  judecatori: 'JDG',
  judecători: 'JDG',
  jud: 'JDG',
  rut: 'RUT',
  '1samuel': '1SA',
  '1sam': '1SA',
  '1sa': '1SA',
  '2samuel': '2SA',
  '2sam': '2SA',
  '2sa': '2SA',
  '1regi': '1KI',
  '1imp': '1KI',
  '1ki': '1KI',
  '2regi': '2KI',
  '2imp': '2KI',
  '2ki': '2KI',
  '1cronici': '1CH',
  '1cron': '1CH',
  '1ch': '1CH',
  '2cronici': '2CH',
  '2cron': '2CH',
  '2ch': '2CH',
  ezra: 'EZR',
  ezr: 'EZR',
  neemia: 'NEH',
  neh: 'NEH',
  estera: 'EST',
  est: 'EST',
  iov: 'JOB',
  job: 'JOB',
  psalmi: 'PSA',
  psalmii: 'PSA',
  psalm: 'PSA',
  ps: 'PSA',
  proverbe: 'PRO',
  prov: 'PRO',
  pro: 'PRO',
  eclesiastul: 'ECC',
  ecl: 'ECC',
  ecc: 'ECC',
  cantarea: 'SNG',
  'cantarea cantarilor': 'SNG',
  cant: 'SNG',
  sng: 'SNG',
  isaia: 'ISA',
  isa: 'ISA',
  is: 'ISA',
  ieremia: 'JER',
  ier: 'JER',
  jer: 'JER',
  plangerile: 'LAM',
  plang: 'LAM',
  lam: 'LAM',
  ezechiel: 'EZK',
  ezec: 'EZK',
  ezk: 'EZK',
  daniel: 'DAN',
  dan: 'DAN',
  osea: 'HOS',
  hos: 'HOS',
  ioel: 'JOL',
  jol: 'JOL',
  amos: 'AMO',
  amo: 'AMO',
  obadia: 'OBA',
  oba: 'OBA',
  iona: 'JON',
  jon: 'JON',
  mica: 'MIC',
  mic: 'MIC',
  naum: 'NAM',
  nam: 'NAM',
  habacuc: 'HAB',
  hab: 'HAB',
  tefania: 'ZEP',
  zef: 'ZEP',
  zep: 'ZEP',
  hagai: 'HAG',
  hag: 'HAG',
  zaharia: 'ZEC',
  zah: 'ZEC',
  zec: 'ZEC',
  maleahi: 'MAL',
  mal: 'MAL',
  // New Testament Romanian
  matei: 'MAT',
  mat: 'MAT',
  marcu: 'MRK',
  mar: 'MRK',
  mrk: 'MRK',
  luca: 'LUK',
  luc: 'LUK',
  luk: 'LUK',
  ioan: 'JHN',
  io: 'JHN',
  jhn: 'JHN',
  faptele: 'ACT',
  fapte: 'ACT',
  act: 'ACT',
  romani: 'ROM',
  rom: 'ROM',
  '1corinteni': '1CO',
  '1cor': '1CO',
  '1co': '1CO',
  '2corinteni': '2CO',
  '2cor': '2CO',
  '2co': '2CO',
  galateni: 'GAL',
  gal: 'GAL',
  efeseni: 'EPH',
  ef: 'EPH',
  eph: 'EPH',
  filipeni: 'PHP',
  fil: 'PHP',
  php: 'PHP',
  coloseni: 'COL',
  col: 'COL',
  '1tesaloniceni': '1TH',
  '1tes': '1TH',
  '1th': '1TH',
  '2tesaloniceni': '2TH',
  '2tes': '2TH',
  '2th': '2TH',
  '1timotei': '1TI',
  '1tim': '1TI',
  '1ti': '1TI',
  '2timotei': '2TI',
  '2tim': '2TI',
  '2ti': '2TI',
  tit: 'TIT',
  filimon: 'PHM',
  flm: 'PHM',
  phm: 'PHM',
  evrei: 'HEB',
  evr: 'HEB',
  heb: 'HEB',
  iacov: 'JAS',
  iac: 'JAS',
  jas: 'JAS',
  '1petru': '1PE',
  '1pet': '1PE',
  '1pe': '1PE',
  '2petru': '2PE',
  '2pet': '2PE',
  '2pe': '2PE',
  '1ioan': '1JN',
  '1io': '1JN',
  '1jn': '1JN',
  '2ioan': '2JN',
  '2io': '2JN',
  '2jn': '2JN',
  '3ioan': '3JN',
  '3io': '3JN',
  '3jn': '3JN',
  iuda: 'JUD',
  jud: 'JUD',
  apocalipsa: 'REV',
  apoc: 'REV',
  rev: 'REV',
  // English names
  genesis: 'GEN',
  exodus: 'EXO',
  leviticus: 'LEV',
  numbers: 'NUM',
  deuteronomy: 'DEU',
  joshua: 'JOS',
  judges: 'JDG',
  ruth: 'RUT',
  '1samuel': '1SA',
  '2samuel': '2SA',
  '1kings': '1KI',
  '2kings': '2KI',
  '1chronicles': '1CH',
  '2chronicles': '2CH',
  nehemiah: 'NEH',
  esther: 'EST',
  psalms: 'PSA',
  proverbs: 'PRO',
  ecclesiastes: 'ECC',
  'song of solomon': 'SNG',
  isaiah: 'ISA',
  jeremiah: 'JER',
  lamentations: 'LAM',
  ezekiel: 'EZK',
  hosea: 'HOS',
  joel: 'JOL',
  obadiah: 'OBA',
  jonah: 'JON',
  micah: 'MIC',
  nahum: 'NAM',
  habakkuk: 'HAB',
  zephaniah: 'ZEP',
  haggai: 'HAG',
  zechariah: 'ZEC',
  malachi: 'MAL',
  matthew: 'MAT',
  mark: 'MRK',
  luke: 'LUK',
  john: 'JHN',
  acts: 'ACT',
  romans: 'ROM',
  '1corinthians': '1CO',
  '2corinthians': '2CO',
  galatians: 'GAL',
  ephesians: 'EPH',
  philippians: 'PHP',
  colossians: 'COL',
  '1thessalonians': '1TH',
  '2thessalonians': '2TH',
  '1timothy': '1TI',
  '2timothy': '2TI',
  titus: 'TIT',
  philemon: 'PHM',
  hebrews: 'HEB',
  james: 'JAS',
  '1peter': '1PE',
  '2peter': '2PE',
  '1john': '1JN',
  '2john': '2JN',
  '3john': '3JN',
  jude: 'JUD',
  revelation: 'REV',
}
