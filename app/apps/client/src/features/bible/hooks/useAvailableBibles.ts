import { useQuery } from '@tanstack/react-query'

import { getApiUrl } from '~/config'

// Use server-side proxy to avoid CORS issues
const getBiblesXmlUrl = () => `${getApiUrl()}/api/bible/available`

export interface AvailableBible {
  name: string
  filename: string
  downloadUrl: string
  copyright: string | null
  sourceLink: string | null
  languageCode: string // Detected language code (e.g., 'af', 'en', 'ro')
}

// Map language names to display names (for normalization)
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  // Common language name variations -> proper display name
  afrikaans: 'Afrikaans',
  albanian: 'Albanian',
  amharic: 'Amharic',
  arabic: 'Arabic',
  armenian: 'Armenian',
  assamese: 'Assamese',
  azerbaijani: 'Azerbaijani',
  basque: 'Basque',
  bavarian: 'Bavarian',
  belarusian: 'Belarusian',
  bengali: 'Bengali',
  bosnian: 'Bosnian',
  breton: 'Breton',
  bulgarian: 'Bulgarian',
  burmese: 'Burmese',
  catalan: 'Catalan',
  cebuano: 'Cebuano',
  chinese: 'Chinese',
  coptic: 'Coptic',
  croatian: 'Croatian',
  czech: 'Czech',
  danish: 'Danish',
  dutch: 'Dutch',
  english: 'English',
  esperanto: 'Esperanto',
  estonian: 'Estonian',
  finnish: 'Finnish',
  french: 'French',
  galician: 'Galician',
  georgian: 'Georgian',
  german: 'German',
  gothic: 'Gothic',
  greek: 'Greek',
  gujarati: 'Gujarati',
  haitian: 'Haitian',
  hausa: 'Hausa',
  hebrew: 'Hebrew',
  hindi: 'Hindi',
  hungarian: 'Hungarian',
  icelandic: 'Icelandic',
  igbo: 'Igbo',
  ilokano: 'Ilokano',
  indonesian: 'Indonesian',
  irish: 'Irish',
  italian: 'Italian',
  japanese: 'Japanese',
  javanese: 'Javanese',
  kannada: 'Kannada',
  kazakh: 'Kazakh',
  khmer: 'Khmer',
  korean: 'Korean',
  kurdish: 'Kurdish',
  lao: 'Lao',
  latin: 'Latin',
  latvian: 'Latvian',
  lithuanian: 'Lithuanian',
  luganda: 'Luganda',
  macedonian: 'Macedonian',
  malagasy: 'Malagasy',
  malay: 'Malay',
  malayalam: 'Malayalam',
  maltese: 'Maltese',
  maori: 'Maori',
  marathi: 'Marathi',
  mongolian: 'Mongolian',
  nepali: 'Nepali',
  norwegian: 'Norwegian',
  oriya: 'Oriya',
  pashto: 'Pashto',
  persian: 'Persian',
  polish: 'Polish',
  portuguese: 'Portuguese',
  punjabi: 'Punjabi',
  quechua: 'Quechua',
  romanian: 'Romanian',
  russian: 'Russian',
  samoan: 'Samoan',
  serbian: 'Serbian',
  shona: 'Shona',
  sindhi: 'Sindhi',
  sinhala: 'Sinhala',
  slovak: 'Slovak',
  slovenian: 'Slovenian',
  somali: 'Somali',
  spanish: 'Spanish',
  sundanese: 'Sundanese',
  swahili: 'Swahili',
  swedish: 'Swedish',
  syriac: 'Syriac',
  tagalog: 'Tagalog',
  tajik: 'Tajik',
  tamil: 'Tamil',
  telugu: 'Telugu',
  thai: 'Thai',
  tibetan: 'Tibetan',
  tigrinya: 'Tigrinya',
  tonga: 'Tonga',
  turkish: 'Turkish',
  twi: 'Twi',
  ukrainian: 'Ukrainian',
  urdu: 'Urdu',
  uzbek: 'Uzbek',
  vietnamese: 'Vietnamese',
  welsh: 'Welsh',
  wolof: 'Wolof',
  xhosa: 'Xhosa',
  yiddish: 'Yiddish',
  yoruba: 'Yoruba',
  zulu: 'Zulu',
  // Regional/ethnic language names
  aceh: 'Aceh',
  batak: 'Batak',
  bikol: 'Bikol',
  bisaya: 'Bisaya',
  cakchiquel: 'Cakchiquel',
  chamorro: 'Chamorro',
  chuukese: 'Chuukese',
  fijian: 'Fijian',
  guarani: 'Guarani',
  hiligaynon: 'Hiligaynon',
  hmong: 'Hmong',
  jivaro: 'Jivaro',
  kabyle: 'Kabyle',
  karen: 'Karen',
  kekchi: 'Kekchi',
  kikuyu: 'Kikuyu',
  kinyarwanda: 'Kinyarwanda',
  kirundi: 'Kirundi',
  krio: 'Krio',
  lingala: 'Lingala',
  lozi: 'Lozi',
  luba: 'Luba',
  mam: 'Mam',
  marshallese: 'Marshallese',
  mizo: 'Mizo',
  naga: 'Naga',
  ndebele: 'Ndebele',
  nyanja: 'Nyanja',
  oromo: 'Oromo',
  palauan: 'Palauan',
  pangasinan: 'Pangasinan',
  papiamento: 'Papiamento',
  pohnpeian: 'Pohnpeian',
  quiche: 'Quiche',
  rundi: 'Rundi',
  sango: 'Sango',
  sepedi: 'Sepedi',
  setswana: 'Setswana',
  tachelhit: 'Tachelhit',
  tahitian: 'Tahitian',
  tok: 'Tok Pisin',
  tongan: 'Tongan',
  tshiluba: 'Tshiluba',
  tswana: 'Tswana',
  tzotzil: 'Tzotzil',
  waray: 'Waray',
  yapese: 'Yapese',
  zapotec: 'Zapotec',
}

/**
 * Extract language from Bible name
 * Examples:
 * - "Aceh Language (Alkitab HABA GET)" -> "Aceh"
 * - "Afrikaans 1983" -> "Afrikaans"
 * - "Bengali 2017 (বাঙালি বাইবেল)" -> "Bengali"
 * - "English-KJV" -> "English"
 */
function detectLanguage(filename: string, name: string): string {
  // First, try to extract language from the name field
  // Common patterns:
  // - "Language Name Year" (e.g., "Afrikaans 1983")
  // - "Language Name (native script)" (e.g., "Bengali 2017 (বাঙালি বাইবেল)")
  // - "Language Language (details)" (e.g., "Aceh Language (Alkitab HABA GET)")

  // Extract text before year, parentheses, or hyphen
  const nameMatch = name.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)/i)
  if (nameMatch) {
    let langWords = nameMatch[1].trim()
    // Remove trailing "Language" if present (e.g., "Aceh Language" -> "Aceh")
    langWords = langWords.replace(/\s+language$/i, '')
    const langKey = langWords.toLowerCase()

    // Check if we have a display name for this language
    if (LANGUAGE_DISPLAY_NAMES[langKey]) {
      return LANGUAGE_DISPLAY_NAMES[langKey]
    }

    // Check first word only
    const firstWord = langWords.split(/\s+/)[0].toLowerCase()
    if (LANGUAGE_DISPLAY_NAMES[firstWord]) {
      return LANGUAGE_DISPLAY_NAMES[firstWord]
    }

    // Return the capitalized first word if it looks like a language name
    if (firstWord.length > 2 && /^[a-z]+$/i.test(firstWord)) {
      return (
        firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
      )
    }
  }

  // Try filename as fallback
  const filenameMatch = filename.match(/^([A-Za-z]+)/i)
  if (filenameMatch) {
    const langName = filenameMatch[1].toLowerCase()
    if (LANGUAGE_DISPLAY_NAMES[langName]) {
      return LANGUAGE_DISPLAY_NAMES[langName]
    }
    // Return capitalized version
    if (langName.length > 2) {
      return langName.charAt(0).toUpperCase() + langName.slice(1).toLowerCase()
    }
  }

  // Return "Unknown" only as last resort
  return 'Unknown'
}

export interface BiblesMetadata {
  totalTranslations: number
  repository: string
  tag: string
}

export interface AvailableBiblesData {
  metadata: BiblesMetadata
  bibles: AvailableBible[]
}

function parseXmlToBibles(xmlContent: string): AvailableBiblesData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')

  // Parse metadata
  const metadataEl = doc.querySelector('metadata')
  const metadata: BiblesMetadata = {
    totalTranslations: Number.parseInt(
      metadataEl?.querySelector('total_translations')?.textContent || '0',
      10,
    ),
    repository: metadataEl?.querySelector('repository')?.textContent || '',
    tag: metadataEl?.querySelector('tag')?.textContent || '',
  }

  // Parse translations
  const translationEls = doc.querySelectorAll('translation')
  const bibles: AvailableBible[] = []

  for (const el of translationEls) {
    const name = el.querySelector('name')?.textContent?.trim()
    const filename = el.querySelector('filename')?.textContent?.trim()
    const downloadUrl = el.querySelector('download_url')?.textContent?.trim()

    if (name && filename && downloadUrl) {
      bibles.push({
        name,
        filename,
        downloadUrl,
        copyright: el.querySelector('copyright')?.textContent?.trim() || null,
        sourceLink:
          el.querySelector('source_link')?.textContent?.trim() || null,
        languageCode: detectLanguage(filename, name),
      })
    }
  }

  return { metadata, bibles }
}

async function fetchAvailableBibles(): Promise<AvailableBiblesData> {
  const response = await fetch(getBiblesXmlUrl(), {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch available Bibles: ${response.statusText}`)
  }
  const xmlContent = await response.text()
  return parseXmlToBibles(xmlContent)
}

export const AVAILABLE_BIBLES_QUERY_KEY = ['bible', 'available-bibles']

export function useAvailableBibles() {
  return useQuery({
    queryKey: AVAILABLE_BIBLES_QUERY_KEY,
    queryFn: fetchAvailableBibles,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - data doesn't change often
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep cached for 7 days
    retry: 2,
  })
}
