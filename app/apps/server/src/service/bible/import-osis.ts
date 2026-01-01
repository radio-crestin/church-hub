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
  console.log(`[${level.toUpperCase()}] [bible:import-osis] ${message}`)
}

/**
 * Maps OSIS book IDs to our standard book codes
 * OSIS uses slightly different abbreviations in some cases
 */
const OSIS_BOOK_MAP: Record<string, string> = {
  Gen: 'GEN',
  Exod: 'EXO',
  Lev: 'LEV',
  Num: 'NUM',
  Deut: 'DEU',
  Josh: 'JOS',
  Judg: 'JDG',
  Ruth: 'RUT',
  '1Sam': '1SA',
  '2Sam': '2SA',
  '1Kgs': '1KI',
  '2Kgs': '2KI',
  '1Chr': '1CH',
  '2Chr': '2CH',
  Ezra: 'EZR',
  Neh: 'NEH',
  Esth: 'EST',
  Job: 'JOB',
  Ps: 'PSA',
  Prov: 'PRO',
  Eccl: 'ECC',
  Song: 'SNG',
  Isa: 'ISA',
  Jer: 'JER',
  Lam: 'LAM',
  Ezek: 'EZK',
  Dan: 'DAN',
  Hos: 'HOS',
  Joel: 'JOL',
  Amos: 'AMO',
  Obad: 'OBA',
  Jonah: 'JON',
  Mic: 'MIC',
  Nah: 'NAM',
  Hab: 'HAB',
  Zeph: 'ZEP',
  Hag: 'HAG',
  Zech: 'ZEC',
  Mal: 'MAL',
  Matt: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Rom: 'ROM',
  '1Cor': '1CO',
  '2Cor': '2CO',
  Gal: 'GAL',
  Eph: 'EPH',
  Phil: 'PHP',
  Col: 'COL',
  '1Thess': '1TH',
  '2Thess': '2TH',
  '1Tim': '1TI',
  '2Tim': '2TI',
  Titus: 'TIT',
  Phlm: 'PHM',
  Heb: 'HEB',
  Jas: 'JAS',
  '1Pet': '1PE',
  '2Pet': '2PE',
  '1John': '1JN',
  '2John': '2JN',
  '3John': '3JN',
  Jude: 'JUD',
  Rev: 'REV',
}

/**
 * Converts an OSIS book ID to our standard book code
 */
function normalizeBookCode(osisId: string): string {
  // First check the mapping
  if (OSIS_BOOK_MAP[osisId]) {
    return OSIS_BOOK_MAP[osisId]
  }
  // Otherwise, try uppercase version
  const upper = osisId.toUpperCase()
  if (BOOK_ORDER[upper]) {
    return upper
  }
  // Return as-is if not found
  return osisId.toUpperCase()
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
 * Finds all book div positions using efficient string scanning
 * Returns array of { bookId, startPos, endPos }
 */
function findBookDivs(
  xmlContent: string,
): Array<{ bookId: string; startPos: number; endPos: number }> {
  const books: Array<{ bookId: string; startPos: number; endPos: number }> = []

  // Find all potential book div starts
  const bookDivPattern = /<div\s+[^>]*type\s*=\s*['"]book['"][^>]*>/gi
  const bookDivPattern2 =
    /<div\s+[^>]*osisID\s*=\s*['"][^'"]+['"][^>]*type\s*=\s*['"]book['"][^>]*>/gi

  let match: RegExpExecArray | null

  // Try first pattern (type before osisID)
  while ((match = bookDivPattern.exec(xmlContent)) !== null) {
    const tagText = match[0]
    // Extract osisID from the tag
    const osisIdMatch = tagText.match(/osisID\s*=\s*['"]([^'"]+)['"]/)
    if (!osisIdMatch) continue

    const bookId = osisIdMatch[1]
    const startPos = match.index + match[0].length

    // Find matching </div> by counting nesting
    const endPos = findMatchingCloseDiv(xmlContent, startPos)
    if (endPos > startPos) {
      books.push({ bookId, startPos, endPos })
    }
  }

  // If no books found, try alternate pattern
  if (books.length === 0) {
    while ((match = bookDivPattern2.exec(xmlContent)) !== null) {
      const tagText = match[0]
      const osisIdMatch = tagText.match(/osisID\s*=\s*['"]([^'"]+)['"]/)
      if (!osisIdMatch) continue

      const bookId = osisIdMatch[1]
      const startPos = match.index + match[0].length
      const endPos = findMatchingCloseDiv(xmlContent, startPos)
      if (endPos > startPos) {
        books.push({ bookId, startPos, endPos })
      }
    }
  }

  return books
}

/**
 * Finds the position of the matching </div> tag, accounting for nesting
 */
function findMatchingCloseDiv(content: string, startPos: number): number {
  let depth = 1
  let pos = startPos

  while (depth > 0 && pos < content.length) {
    const nextOpen = content.indexOf('<div', pos)
    const nextClose = content.indexOf('</div>', pos)

    if (nextClose === -1) {
      // No more closing tags found
      return content.length
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      // Check if this is a self-closing div
      const tagEnd = content.indexOf('>', nextOpen)
      if (tagEnd !== -1 && content[tagEnd - 1] === '/') {
        // Self-closing, skip it
        pos = tagEnd + 1
      } else {
        // Opening div, increase depth
        depth++
        pos = tagEnd + 1
      }
    } else {
      // Closing div found first
      depth--
      if (depth === 0) {
        return nextClose
      }
      pos = nextClose + 6 // length of '</div>'
    }
  }

  return content.length
}

/**
 * Parses OSIS XML content and extracts Bible structure
 * Handles both container-style verses (<verse>text</verse>) and
 * milestoned verses (<verse sID="..."/>text<verse eID="..."/>)
 */
export function parseOsisXml(xmlContent: string): ParsedBible {
  const books: ParsedBook[] = []

  log('info', 'Finding book divisions...')

  // Use efficient position-based extraction instead of catastrophic regex
  const bookDivs = findBookDivs(xmlContent)

  log('info', `Found ${bookDivs.length} book divisions`)

  let processedCount = 0
  for (const { bookId, startPos, endPos } of bookDivs) {
    const bookContent = xmlContent.substring(startPos, endPos)
    log(
      'info',
      `Processing book ${bookId} (${processedCount + 1}/${bookDivs.length}, size: ${bookContent.length} chars)`,
    )
    processBook(bookId, bookContent, books)
    processedCount++
  }

  log('info', `Processed ${processedCount} book divisions`)

  // Sort books by order
  books.sort((a, b) => a.bookOrder - b.bookOrder)

  log('info', `Parsed ${books.length} books from OSIS format`)
  return { books }
}

function processBook(
  osisBookId: string,
  bookContent: string,
  books: ParsedBook[],
) {
  const bookCode = normalizeBookCode(osisBookId)
  const bookOrder = BOOK_ORDER[bookCode] || 0

  if (bookOrder === 0) {
    log(
      'warning',
      `Unknown OSIS book code: ${osisBookId} -> ${bookCode}, skipping`,
    )
    return
  }

  // Extract book name from title element if present
  const titleMatch = bookContent.match(/<title[^>]*>([^<]+)<\/title>/)
  const bookName = titleMatch ? titleMatch[1].trim() : osisBookId

  const chapters: ParsedChapter[] = []

  // Try container-style verses first using efficient position-based extraction
  // Pattern: <verse osisID="Gen.1.1">text</verse>
  parseContainerVerses(bookContent, chapters)

  // If no container verses found, try milestoned style
  if (chapters.length === 0) {
    parseMilestonedVerses(bookContent, chapters)
  }

  if (chapters.length > 0) {
    books.push({
      bookCode,
      bookName,
      bookOrder,
      chapters,
    })
    log('debug', `Parsed book ${bookCode}: ${chapters.length} chapters`)
  }
}

/**
 * Parse container-style verses efficiently using indexOf
 * Pattern: <verse osisID="Gen.1.1">text</verse>
 */
function parseContainerVerses(bookContent: string, chapters: ParsedChapter[]) {
  // Find all verse opening tags (just the tag, not content)
  const verseOpenRegex = /<verse\s+[^>]*osisID\s*=\s*['"]([^'"]+)['"][^>]*>/gi

  const versePositions: Array<{ ref: string; contentStart: number }> = []
  let match: RegExpExecArray | null

  while ((match = verseOpenRegex.exec(bookContent)) !== null) {
    // Check if this is a self-closing tag (milestoned style)
    if (match[0].endsWith('/>')) continue

    versePositions.push({
      ref: match[1],
      contentStart: match.index + match[0].length,
    })
  }

  // Debug: log first verse sample if no container verses found
  if (versePositions.length === 0) {
    // Check if there are any verse tags at all
    const anyVerseMatch = bookContent.match(/<verse[^>]*>/i)
    if (anyVerseMatch) {
      log(
        'info',
        `No container verses. Sample verse tag: ${anyVerseMatch[0].substring(0, 200)}`,
      )
    } else {
      log(
        'info',
        `No verse tags found in book content (first 500 chars): ${bookContent.substring(0, 500)}`,
      )
    }
  }

  let currentChapter = 0
  let currentVerses: ParsedVerse[] = []

  for (const versePos of versePositions) {
    // Find the closing </verse> tag
    const closePos = bookContent.indexOf('</verse>', versePos.contentStart)
    if (closePos === -1) continue

    const verseText = bookContent.substring(versePos.contentStart, closePos)

    // Parse the osisID: Book.Chapter.Verse
    const parts = versePos.ref.split('.')
    if (parts.length < 3) continue

    const chapter = Number.parseInt(parts[1], 10)
    const verse = Number.parseInt(parts[2], 10)

    if (Number.isNaN(chapter) || Number.isNaN(verse)) continue

    // If chapter changed, save previous chapter
    if (chapter !== currentChapter) {
      if (currentChapter > 0 && currentVerses.length > 0) {
        chapters.push({
          chapter: currentChapter,
          verses: currentVerses,
        })
      }
      currentChapter = chapter
      currentVerses = []
    }

    const cleanedText = cleanVerseText(verseText)
    if (cleanedText) {
      currentVerses.push({
        verse,
        text: cleanedText,
      })
    }
  }

  // Save last chapter
  if (currentChapter > 0 && currentVerses.length > 0) {
    chapters.push({
      chapter: currentChapter,
      verses: currentVerses,
    })
  }
}

/**
 * Parse milestoned verse style:
 * <verse sID="Gen.1.1"/>In the beginning...<verse eID="Gen.1.1"/>
 */
function parseMilestonedVerses(bookContent: string, chapters: ParsedChapter[]) {
  // Find all verse start and end markers
  const verseStartRegex = /<verse\s+sID\s*=\s*['"]([^'"]+)['"][^>]*\/>/gi
  const verseEndRegex = /<verse\s+eID\s*=\s*['"]([^'"]+)['"][^>]*\/>/gi

  // Get all start positions
  const starts: { ref: string; position: number; endPosition: number }[] = []
  let match: RegExpExecArray | null
  while ((match = verseStartRegex.exec(bookContent)) !== null) {
    starts.push({
      ref: match[1],
      position: match.index,
      endPosition: match.index + match[0].length,
    })
  }

  log('info', `Milestoned: found ${starts.length} verse start markers`)

  // Get all end positions
  const ends: Map<string, number> = new Map()
  while ((match = verseEndRegex.exec(bookContent)) !== null) {
    ends.set(match[1], match.index)
  }

  let currentChapter = 0
  let currentVerses: ParsedVerse[] = []

  for (const start of starts) {
    const parts = start.ref.split('.')
    if (parts.length < 3) continue

    const chapter = Number.parseInt(parts[1], 10)
    const verse = Number.parseInt(parts[2], 10)

    if (Number.isNaN(chapter) || Number.isNaN(verse)) continue

    // If chapter changed, save previous chapter
    if (chapter !== currentChapter) {
      if (currentChapter > 0 && currentVerses.length > 0) {
        chapters.push({
          chapter: currentChapter,
          verses: currentVerses,
        })
      }
      currentChapter = chapter
      currentVerses = []
    }

    // Get end position
    const endPos = ends.get(start.ref) || bookContent.length
    const verseText = bookContent.substring(start.endPosition, endPos)

    const cleanedText = cleanVerseText(verseText)
    if (cleanedText) {
      currentVerses.push({
        verse,
        text: cleanedText,
      })
    }
  }

  // Save last chapter
  if (currentChapter > 0 && currentVerses.length > 0) {
    chapters.push({
      chapter: currentChapter,
      verses: currentVerses,
    })
  }
}
