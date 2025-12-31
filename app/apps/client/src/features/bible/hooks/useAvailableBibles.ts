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

// Map language names (from filenames) to ISO language codes
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  afrikaans: 'af',
  albanian: 'sq',
  arabic: 'ar',
  armenian: 'hy',
  basque: 'eu',
  bavarian: 'bar',
  bulgarian: 'bg',
  chinese: 'zh',
  croatian: 'hr',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en',
  esperanto: 'eo',
  finnish: 'fi',
  french: 'fr',
  german: 'de',
  hungarian: 'hu',
  indonesian: 'id',
  italian: 'it',
  jivaro: 'jiv',
  kabyle: 'kab',
  korean: 'ko',
  latin: 'la',
  latvian: 'lv',
  lithuanian: 'lt',
  maori: 'mi',
  norwegian: 'no',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  spanish: 'es',
  swahili: 'sw',
  swedish: 'sv',
  tagalog: 'tl',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  vietnamese: 'vi',
  // Add more as needed
}

/**
 * Extract language code from Bible filename or name
 * Examples:
 * - "Afrikaans-1983_Bybel-AF83.xml" -> "af"
 * - "English-KJV.xml" -> "en"
 * - "Romanian-Cornilescu.xml" -> "ro"
 */
function detectLanguageCode(filename: string, name: string): string {
  // Try to extract language from filename (usually the first part before - or _)
  const filenameMatch = filename.match(/^([A-Za-z]+)/i)
  if (filenameMatch) {
    const langName = filenameMatch[1].toLowerCase()
    if (LANGUAGE_NAME_TO_CODE[langName]) {
      return LANGUAGE_NAME_TO_CODE[langName]
    }
  }

  // Try to extract from name (first word)
  const nameMatch = name.match(/^([A-Za-z]+)/i)
  if (nameMatch) {
    const langName = nameMatch[1].toLowerCase()
    if (LANGUAGE_NAME_TO_CODE[langName]) {
      return LANGUAGE_NAME_TO_CODE[langName]
    }
  }

  // Default to 'en' if we can't detect
  return 'en'
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
    totalTranslations: Number.parseInt(metadataEl?.querySelector('total_translations')?.textContent || '0', 10),
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
        sourceLink: el.querySelector('source_link')?.textContent?.trim() || null,
        languageCode: detectLanguageCode(filename, name),
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
