#!/usr/bin/env bun
/**
 * Script to generate bibleBooks.json files for i18n
 *
 * Fetches book names from arron-taylor/bible-versions repository
 * which contains translations in 58+ languages.
 *
 * Run with: bun run scripts/generate-bible-book-names.ts
 */

import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

// URLs for the open source Bible book names data
const BOOK_NAME_MAPPING_URL =
  'https://raw.githubusercontent.com/arron-taylor/bible-versions/main/book_name_mapping.json'
const LOCALE_VERSION_MAP_URL =
  'https://raw.githubusercontent.com/arron-taylor/bible-versions/main/locale_version_map.json'

// Standard book codes in canonical order (OSIS standard)
const BOOK_CODES = [
  // Old Testament
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT',
  '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
  'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER',
  'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
  'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  // New Testament
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO',
  'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI',
  'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN',
  '3JN', 'JUD', 'REV'
] as const

// English book names as keys in the mapping
const ENGLISH_BOOK_NAMES = [
  // Old Testament
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
  // New Testament
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation'
] as const

interface BookName {
  name: string
  short: string
}

interface BookNamesMap {
  [code: string]: BookName
}

// Maps translation names to locale codes
const TRANSLATION_TO_LOCALE: Record<string, string> = {
  'AFRIKAANS PWL': 'af',
  'ALBANIAN': 'sq',
  'ARABIC: SMITH & VAN DYKE': 'ar',
  'BAVARIAN': 'bar',
  'BULGARIAN': 'bg',
  'CHINESE BIBLE: UNION (TRADITIONAL)': 'zh-TW',
  'CHINESE BIBLE: UNION (SIMPLIFIED)': 'zh-CN',
  'CROATIAN BIBLE': 'hr',
  'CZECH BKR': 'cs',
  'DANISH': 'da',
  'DUTCH STATEN VERTALING': 'nl',
  'HUNGARIAN: KAROLI': 'hu',
  'ESPERANTO': 'eo',
  'FINNISH: BIBLE (1776)': 'fi',
  'FRENCH: DARBY': 'fr',
  'FRENCH: LOUIS SEGOND (1910)': 'fr-LS',
  'FRENCH: MARTIN (1744)': 'fr-M',
  'GERMAN: MODERNIZED': 'de',
  'GERMAN: LUTHER (1912)': 'de-LU',
  'GERMAN: TEXTBIBEL (1899)': 'de-TB',
  'ITALIAN: RIVEDUTA BIBLE (1927)': 'it',
  'ITALIAN: GIOVANNI DIODATI BIBLE (1649)': 'it-GD',
  'INDONESIAN - TERJEMAHAN LAMA (TL)': 'id',
  'KOREAN': 'ko',
  'LATIN: VULGATA CLEMENTINA': 'la',
  'LITHUANIAN': 'lt',
  'MAORI': 'mi',
  'NORWEGIAN: DET NORSK BIBELSELSKAP (1930)': 'no',
  'LA BIBLIA DE LAS AMÉRICAS': 'es',
  'LA NUEVA BIBLIA DE LOS HISPANOS': 'es-NH',
  'REINA VALERA GÓMEZ': 'es-RVG',
  'REINA VALERA 1909': 'es-RV',
  'SAGRADAS ESCRITURAS 1569': 'es-SE',
  'BÍBLIA KING JAMES ATUALIZADA PORTUGUÊS': 'pt-BR',
  'PORTUGESE BIBLE': 'pt',
  'ROMANIAN: CORNILESCU': 'ro',
  'RUSSIAN: SYNODAL TRANSLATION (1876)': 'ru',
  'RUSSIAN KOI8R': 'ru-KOI',
  'SWEDISH (1917)': 'sv',
  'TAGALOG: ANG DATING BIBLIA (1905)': 'tl',
  'THAI: FROM KJV': 'th',
  'TURKISH': 'tr',
  'VIETNAMESE (1934)': 'vi',
  'ARMENIAN (WESTERN): NT': 'hy',
  'BASQUE (NAVARRO-LABOURDIN): NT': 'eu',
  'GREEK NT: TISCHENDORF 8TH ED.': 'el',
  'BYZANTINE/MAJORITY TEXT (2000)': 'el-BYZ',
  "STEPHENS TEXTUS RECEPTUS (1550)": 'grc-TR',
  "SCRIVENER'S TEXTUS RECEPTUS (1894)": 'grc-SCR',
  'WESTCOTT/HORT': 'grc-WH',
  'WESTCOTT/HORT, UBS4 VARIANTS': 'grc-UBS',
  'KABYLE: NT': 'kab',
  'LATVIAN NEW TESTAMENT': 'lv',
  'SHUAR NEW TESTAMENT': 'jiv',
  'SWAHILI NT': 'sw',
  'TAWALLAMAT TAMAJAQ NT': 'ttq',
  'UKRAINIAN: NT': 'uk',
  'UMA NEW TESTAMENT': 'ppk',
  // KJV variants for English
  'AUTHORIZED KING JAMES VERSION (1611 / 1769)': 'en',
}

// Generate short abbreviation from full name
function generateShortName(name: string): string {
  // Remove numbers at the beginning
  const cleaned = name.replace(/^[0-9]+\s*/, '')
  // Take first 3 characters of the main word
  const abbrev = cleaned.substring(0, 3)
  // Add number prefix back if present
  const numMatch = name.match(/^([0-9]+)/)
  if (numMatch) {
    return numMatch[1] + abbrev
  }
  return abbrev
}

async function fetchBookNameMapping(): Promise<Record<string, Record<string, string>>> {
  console.log('Fetching book name mapping from GitHub...')
  const response = await fetch(BOOK_NAME_MAPPING_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch book name mapping: ${response.statusText}`)
  }
  return response.json()
}

async function generateBibleBooksJson() {
  const outputDir = join(import.meta.dir, '..', 'apps', 'client', 'src', 'i18n', 'locales')

  // Fetch the book name mapping
  const bookNameMapping = await fetchBookNameMapping()
  console.log(`Fetched ${Object.keys(bookNameMapping).length} translations`)

  // Track generated languages
  const generatedLanguages: string[] = []
  const processedLocales = new Set<string>()

  // Process each translation
  for (const [translationName, bookNames] of Object.entries(bookNameMapping)) {
    // Get the locale code for this translation
    let locale = TRANSLATION_TO_LOCALE[translationName]

    if (!locale) {
      console.warn(`No locale mapping for translation: ${translationName}`)
      continue
    }

    // For duplicate locales, skip (we use the first one)
    // Exception: allow the primary locale (without variant) to be overwritten
    const baseLocale = locale.split('-')[0]
    if (processedLocales.has(locale)) {
      continue
    }

    // Build the book names map
    const booksMap: BookNamesMap = {}
    let hasAllBooks = true

    for (let i = 0; i < BOOK_CODES.length; i++) {
      const code = BOOK_CODES[i]
      const englishName = ENGLISH_BOOK_NAMES[i]
      const translatedName = bookNames[englishName]

      if (!translatedName) {
        // For NT-only translations, skip OT books
        if (i < 39) {
          hasAllBooks = false
          continue
        }
        console.warn(`Missing ${englishName} (${code}) in ${translationName}`)
        continue
      }

      booksMap[code] = {
        name: translatedName,
        short: generateShortName(translatedName)
      }
    }

    // Only generate files for translations with all 66 books (Full Bible)
    // Or if it's a base locale we haven't processed yet
    if (!hasAllBooks && processedLocales.has(baseLocale)) {
      continue
    }

    // Use base locale for the file if we haven't generated it yet
    const targetLocale = !processedLocales.has(baseLocale) ? baseLocale : locale
    processedLocales.add(targetLocale)

    const langDir = join(outputDir, targetLocale)
    await mkdir(langDir, { recursive: true })

    const outputPath = join(langDir, 'bibleBooks.json')
    const content = JSON.stringify(booksMap, null, 2)
    await writeFile(outputPath, content, 'utf-8')

    console.log(`Generated: ${outputPath} (${Object.keys(booksMap).length} books)`)
    generatedLanguages.push(targetLocale)
  }

  console.log(`\nGenerated bibleBooks.json for ${generatedLanguages.length} languages:`)
  console.log(generatedLanguages.sort().join(', '))
}

// Run the script
generateBibleBooksJson().catch(console.error)
