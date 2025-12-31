import type { ParsedBible, ParsedBook, ParsedChapter, ParsedVerse } from './types'
import { BOOK_ORDER } from './types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:import-zefania] ${message}`)
}

/**
 * Maps Zefania book numbers to our standard book codes
 * Zefania uses numeric book IDs (1-66 for standard canon)
 */
const BOOK_NUMBER_MAP: Record<number, string> = {
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
 * Cleans verse text by removing XML tags and normalizing whitespace
 */
function cleanVerseText(text: string): string {
  let cleaned = text
    // Remove self-closing tags
    .replace(/<[^>]+\/>/g, '')
    // Remove opening tags
    .replace(/<[^/][^>]*>/g, '')
    // Remove closing tags
    .replace(/<\/[^>]+>/g, '')
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
 * Parses Zefania XML content and extracts Bible structure
 * Zefania format uses:
 * - <XMLBIBLE> root element
 * - <BIBLEBOOK bnumber="1" bname="Genesis"> for books
 * - <CHAPTER cnumber="1"> for chapters
 * - <VERS vnumber="1">verse text</VERS> for verses
 */
export function parseZefaniaXml(xmlContent: string): ParsedBible {
  const books: ParsedBook[] = []

  // Extract all BIBLEBOOK elements
  const bookRegex = /<BIBLEBOOK\s+([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/gi
  let bookMatch: RegExpExecArray | null

  while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
    const bookAttrs = bookMatch[1]
    const bookContent = bookMatch[2]

    // Extract bnumber attribute
    const bnumberMatch = bookAttrs.match(/bnumber\s*=\s*['"](\d+)['"]/)
    const bnumber = bnumberMatch ? Number.parseInt(bnumberMatch[1], 10) : 0

    // Extract bname attribute for book name
    const bnameMatch = bookAttrs.match(/bname\s*=\s*['"]([^'"]+)['"]/)
    const bookName = bnameMatch ? bnameMatch[1] : `Book ${bnumber}`

    // Get book code from number mapping
    const bookCode = BOOK_NUMBER_MAP[bnumber]
    if (!bookCode) {
      log('warning', `Unknown Zefania book number: ${bnumber}, skipping`)
      continue
    }

    const bookOrder = BOOK_ORDER[bookCode] || 0
    if (bookOrder === 0) {
      log('warning', `Unknown book code from Zefania: ${bookCode}, skipping`)
      continue
    }

    const chapters: ParsedChapter[] = []

    // Extract all CHAPTER elements within this book
    const chapterRegex = /<CHAPTER\s+([^>]*)>([\s\S]*?)<\/CHAPTER>/gi
    let chapterMatch: RegExpExecArray | null

    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      const chapterAttrs = chapterMatch[1]
      const chapterContent = chapterMatch[2]

      // Extract cnumber attribute
      const cnumberMatch = chapterAttrs.match(/cnumber\s*=\s*['"](\d+)['"]/)
      const chapterNum = cnumberMatch ? Number.parseInt(cnumberMatch[1], 10) : 0

      if (chapterNum === 0) continue

      const verses: ParsedVerse[] = []

      // Extract all VERS elements within this chapter
      const verseRegex = /<VERS\s+([^>]*)>([^<]*(?:<(?!\/VERS)[^>]*>[^<]*)*)<\/VERS>/gi
      let verseMatch: RegExpExecArray | null

      while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
        const verseAttrs = verseMatch[1]
        const verseText = verseMatch[2]

        // Extract vnumber attribute
        const vnumberMatch = verseAttrs.match(/vnumber\s*=\s*['"](\d+)['"]/)
        const verseNum = vnumberMatch ? Number.parseInt(vnumberMatch[1], 10) : 0

        if (verseNum === 0) continue

        const cleanedText = cleanVerseText(verseText)
        if (cleanedText) {
          verses.push({
            verse: verseNum,
            text: cleanedText,
          })
        }
      }

      if (verses.length > 0) {
        chapters.push({
          chapter: chapterNum,
          verses,
        })
      }
    }

    if (chapters.length > 0) {
      books.push({
        bookCode,
        bookName,
        bookOrder,
        chapters,
      })
      log('debug', `Parsed book ${bookCode} (${bookName}): ${chapters.length} chapters`)
    }
  }

  // Sort books by order
  books.sort((a, b) => a.bookOrder - b.bookOrder)

  log('info', `Parsed ${books.length} books from Zefania format`)
  return { books }
}
