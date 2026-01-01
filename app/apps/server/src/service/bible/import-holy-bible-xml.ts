import type {
  ParsedBible,
  ParsedBook,
  ParsedChapter,
  ParsedVerse,
} from './types'
import { BOOK_ORDER } from './types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(
    `[${level.toUpperCase()}] [bible:import-holy-bible-xml] ${message}`,
  )
}

/**
 * Maps book numbers (1-66) to standard book codes
 * Holy-Bible-XML-Format uses sequential numbering for books
 */
const BOOK_NUMBER_TO_CODE: Record<number, string> = {
  // Old Testament (1-39)
  1: 'GEN',
  2: 'EXO',
  3: 'LEV',
  4: 'NUM',
  5: 'DEU',
  6: 'JOS',
  7: 'JDG',
  8: 'RUT',
  9: '1SA',
  10: '2SA',
  11: '1KI',
  12: '2KI',
  13: '1CH',
  14: '2CH',
  15: 'EZR',
  16: 'NEH',
  17: 'EST',
  18: 'JOB',
  19: 'PSA',
  20: 'PRO',
  21: 'ECC',
  22: 'SNG',
  23: 'ISA',
  24: 'JER',
  25: 'LAM',
  26: 'EZK',
  27: 'DAN',
  28: 'HOS',
  29: 'JOL',
  30: 'AMO',
  31: 'OBA',
  32: 'JON',
  33: 'MIC',
  34: 'NAM',
  35: 'HAB',
  36: 'ZEP',
  37: 'HAG',
  38: 'ZEC',
  39: 'MAL',
  // New Testament (40-66)
  40: 'MAT',
  41: 'MRK',
  42: 'LUK',
  43: 'JHN',
  44: 'ACT',
  45: 'ROM',
  46: '1CO',
  47: '2CO',
  48: 'GAL',
  49: 'EPH',
  50: 'PHP',
  51: 'COL',
  52: '1TH',
  53: '2TH',
  54: '1TI',
  55: '2TI',
  56: 'TIT',
  57: 'PHM',
  58: 'HEB',
  59: 'JAS',
  60: '1PE',
  61: '2PE',
  62: '1JN',
  63: '2JN',
  64: '3JN',
  65: 'JUD',
  66: 'REV',
}

/**
 * Default book names (English) for when not provided in XML
 */
const DEFAULT_BOOK_NAMES: Record<string, string> = {
  GEN: 'Genesis',
  EXO: 'Exodus',
  LEV: 'Leviticus',
  NUM: 'Numbers',
  DEU: 'Deuteronomy',
  JOS: 'Joshua',
  JDG: 'Judges',
  RUT: 'Ruth',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  '1CH': '1 Chronicles',
  '2CH': '2 Chronicles',
  EZR: 'Ezra',
  NEH: 'Nehemiah',
  EST: 'Esther',
  JOB: 'Job',
  PSA: 'Psalms',
  PRO: 'Proverbs',
  ECC: 'Ecclesiastes',
  SNG: 'Song of Solomon',
  ISA: 'Isaiah',
  JER: 'Jeremiah',
  LAM: 'Lamentations',
  EZK: 'Ezekiel',
  DAN: 'Daniel',
  HOS: 'Hosea',
  JOL: 'Joel',
  AMO: 'Amos',
  OBA: 'Obadiah',
  JON: 'Jonah',
  MIC: 'Micah',
  NAM: 'Nahum',
  HAB: 'Habakkuk',
  ZEP: 'Zephaniah',
  HAG: 'Haggai',
  ZEC: 'Zechariah',
  MAL: 'Malachi',
  MAT: 'Matthew',
  MRK: 'Mark',
  LUK: 'Luke',
  JHN: 'John',
  ACT: 'Acts',
  ROM: 'Romans',
  '1CO': '1 Corinthians',
  '2CO': '2 Corinthians',
  GAL: 'Galatians',
  EPH: 'Ephesians',
  PHP: 'Philippians',
  COL: 'Colossians',
  '1TH': '1 Thessalonians',
  '2TH': '2 Thessalonians',
  '1TI': '1 Timothy',
  '2TI': '2 Timothy',
  TIT: 'Titus',
  PHM: 'Philemon',
  HEB: 'Hebrews',
  JAS: 'James',
  '1PE': '1 Peter',
  '2PE': '2 Peter',
  '1JN': '1 John',
  '2JN': '2 John',
  '3JN': '3 John',
  JUD: 'Jude',
  REV: 'Revelation',
}

/**
 * Cleans verse text by normalizing whitespace and decoding entities
 */
function cleanVerseText(text: string): string {
  let cleaned = text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  return cleaned
}

/**
 * Parses Holy-Bible-XML-Format XML content
 *
 * Format structure:
 * <bible translation="Name" status="Copyright info">
 *   <testament name="Old|New">
 *     <book number="1-66" name="Optional book name">
 *       <chapter number="1">
 *         <verse number="1">Text content</verse>
 *       </chapter>
 *     </book>
 *   </testament>
 * </bible>
 */
export function parseHolyBibleXml(xmlContent: string): ParsedBible {
  const books: ParsedBook[] = []

  log('info', 'Parsing Holy-Bible-XML-Format...')

  // Find all book elements using regex (efficient for this simple structure)
  const bookRegex =
    /<book\s+number\s*=\s*["'](\d+)["'](?:\s+name\s*=\s*["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/book>/gi

  let bookMatch: RegExpExecArray | null
  let bookCount = 0

  while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
    const bookNumber = Number.parseInt(bookMatch[1], 10)
    const bookNameFromXml = bookMatch[2] || null
    const bookContent = bookMatch[3]

    const bookCode = BOOK_NUMBER_TO_CODE[bookNumber]
    if (!bookCode) {
      log('warning', `Unknown book number: ${bookNumber}, skipping`)
      continue
    }

    const bookOrder = BOOK_ORDER[bookCode]
    const bookName =
      bookNameFromXml || DEFAULT_BOOK_NAMES[bookCode] || `Book ${bookNumber}`

    log('debug', `Processing book ${bookNumber}: ${bookName} (${bookCode})`)

    const chapters = parseChapters(bookContent)

    if (chapters.length > 0) {
      books.push({
        bookCode,
        bookName,
        bookOrder,
        chapters,
      })
      bookCount++
    }
  }

  // Sort books by order
  books.sort((a, b) => a.bookOrder - b.bookOrder)

  log('info', `Parsed ${bookCount} books from Holy-Bible-XML-Format`)
  return { books }
}

/**
 * Parses chapters from book content
 */
function parseChapters(bookContent: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = []

  const chapterRegex =
    /<chapter\s+number\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/chapter>/gi

  let chapterMatch: RegExpExecArray | null

  while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
    const chapterNumber = Number.parseInt(chapterMatch[1], 10)
    const chapterContent = chapterMatch[2]

    const verses = parseVerses(chapterContent)

    if (verses.length > 0) {
      chapters.push({
        chapter: chapterNumber,
        verses,
      })
    }
  }

  // Sort chapters by number
  chapters.sort((a, b) => a.chapter - b.chapter)

  return chapters
}

/**
 * Parses verses from chapter content
 */
function parseVerses(chapterContent: string): ParsedVerse[] {
  const verses: ParsedVerse[] = []

  const verseRegex =
    /<verse\s+number\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/verse>/gi

  let verseMatch: RegExpExecArray | null

  while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
    const verseNumber = Number.parseInt(verseMatch[1], 10)
    const verseText = verseMatch[2]

    const cleanedText = cleanVerseText(verseText)

    if (cleanedText) {
      verses.push({
        verse: verseNumber,
        text: cleanedText,
      })
    }
  }

  // Sort verses by number
  verses.sort((a, b) => a.verse - b.verse)

  return verses
}
