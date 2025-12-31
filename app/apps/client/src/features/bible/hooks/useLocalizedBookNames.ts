import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useSelectedBibleTranslations } from './useSelectedBibleTranslations'

// Import all bibleBooks.json files statically for bundling
import bibleBooksAf from '~/i18n/locales/af/bibleBooks.json'
import bibleBooksAr from '~/i18n/locales/ar/bibleBooks.json'
import bibleBooksBar from '~/i18n/locales/bar/bibleBooks.json'
import bibleBooksBg from '~/i18n/locales/bg/bibleBooks.json'
import bibleBooksCs from '~/i18n/locales/cs/bibleBooks.json'
import bibleBooksDa from '~/i18n/locales/da/bibleBooks.json'
import bibleBooksDe from '~/i18n/locales/de/bibleBooks.json'
import bibleBooksEn from '~/i18n/locales/en/bibleBooks.json'
import bibleBooksEo from '~/i18n/locales/eo/bibleBooks.json'
import bibleBooksEs from '~/i18n/locales/es/bibleBooks.json'
import bibleBooksEu from '~/i18n/locales/eu/bibleBooks.json'
import bibleBooksFi from '~/i18n/locales/fi/bibleBooks.json'
import bibleBooksFr from '~/i18n/locales/fr/bibleBooks.json'
import bibleBooksHr from '~/i18n/locales/hr/bibleBooks.json'
import bibleBooksHu from '~/i18n/locales/hu/bibleBooks.json'
import bibleBooksHy from '~/i18n/locales/hy/bibleBooks.json'
import bibleBooksId from '~/i18n/locales/id/bibleBooks.json'
import bibleBooksIt from '~/i18n/locales/it/bibleBooks.json'
import bibleBooksJiv from '~/i18n/locales/jiv/bibleBooks.json'
import bibleBooksKab from '~/i18n/locales/kab/bibleBooks.json'
import bibleBooksKo from '~/i18n/locales/ko/bibleBooks.json'
import bibleBooksLa from '~/i18n/locales/la/bibleBooks.json'
import bibleBooksLt from '~/i18n/locales/lt/bibleBooks.json'
import bibleBooksLv from '~/i18n/locales/lv/bibleBooks.json'
import bibleBooksMi from '~/i18n/locales/mi/bibleBooks.json'
import bibleBooksNl from '~/i18n/locales/nl/bibleBooks.json'
import bibleBooksNo from '~/i18n/locales/no/bibleBooks.json'
import bibleBooksPpk from '~/i18n/locales/ppk/bibleBooks.json'
import bibleBooksPt from '~/i18n/locales/pt/bibleBooks.json'
import bibleBooksRo from '~/i18n/locales/ro/bibleBooks.json'
import bibleBooksRu from '~/i18n/locales/ru/bibleBooks.json'
import bibleBooksSq from '~/i18n/locales/sq/bibleBooks.json'
import bibleBooksSv from '~/i18n/locales/sv/bibleBooks.json'
import bibleBooksSw from '~/i18n/locales/sw/bibleBooks.json'
import bibleBooksTh from '~/i18n/locales/th/bibleBooks.json'
import bibleBooksTl from '~/i18n/locales/tl/bibleBooks.json'
import bibleBooksTr from '~/i18n/locales/tr/bibleBooks.json'
import bibleBooksTtq from '~/i18n/locales/ttq/bibleBooks.json'
import bibleBooksUk from '~/i18n/locales/uk/bibleBooks.json'
import bibleBooksVi from '~/i18n/locales/vi/bibleBooks.json'
import bibleBooksZh from '~/i18n/locales/zh/bibleBooks.json'
import bibleBooksZhCN from '~/i18n/locales/zh-CN/bibleBooks.json'

type BookNameEntry = { name: string; short: string }
type BibleBooksMap = Record<string, BookNameEntry>

// Map of language codes to their bibleBooks data
const BIBLE_BOOKS_BY_LANGUAGE: Record<string, BibleBooksMap> = {
  af: bibleBooksAf,
  ar: bibleBooksAr,
  bar: bibleBooksBar,
  bg: bibleBooksBg,
  cs: bibleBooksCs,
  da: bibleBooksDa,
  de: bibleBooksDe,
  en: bibleBooksEn,
  eo: bibleBooksEo,
  es: bibleBooksEs,
  eu: bibleBooksEu,
  fi: bibleBooksFi,
  fr: bibleBooksFr,
  hr: bibleBooksHr,
  hu: bibleBooksHu,
  hy: bibleBooksHy,
  id: bibleBooksId,
  it: bibleBooksIt,
  jiv: bibleBooksJiv,
  kab: bibleBooksKab,
  ko: bibleBooksKo,
  la: bibleBooksLa,
  lt: bibleBooksLt,
  lv: bibleBooksLv,
  mi: bibleBooksMi,
  nl: bibleBooksNl,
  no: bibleBooksNo,
  ppk: bibleBooksPpk,
  pt: bibleBooksPt,
  ro: bibleBooksRo,
  ru: bibleBooksRu,
  sq: bibleBooksSq,
  sv: bibleBooksSv,
  sw: bibleBooksSw,
  th: bibleBooksTh,
  tl: bibleBooksTl,
  tr: bibleBooksTr,
  ttq: bibleBooksTtq,
  uk: bibleBooksUk,
  vi: bibleBooksVi,
  zh: bibleBooksZh,
  'zh-CN': bibleBooksZhCN,
}

/**
 * Normalizes a language code to find the best match in available translations
 * e.g., "auto" -> user's language, "en-US" -> "en"
 */
function normalizeLanguage(language: string, userLanguage: string): string {
  // If "auto" or empty, use user's language
  if (!language || language === 'auto') {
    return userLanguage
  }

  // First try exact match
  if (BIBLE_BOOKS_BY_LANGUAGE[language]) {
    return language
  }

  // Try base language (e.g., "en-US" -> "en")
  const baseLang = language.split('-')[0]
  if (BIBLE_BOOKS_BY_LANGUAGE[baseLang]) {
    return baseLang
  }

  // Fall back to user's language
  return userLanguage
}

/**
 * Hook to get localized book names based on the primary Bible translation's language
 *
 * Priority:
 * 1. Primary translation's language (if bibleBooks.json exists for it)
 * 2. User's current app language (fallback)
 * 3. English (ultimate fallback)
 */
export function useLocalizedBookNames() {
  const { i18n } = useTranslation()
  const { primaryTranslation } = useSelectedBibleTranslations()

  const userLanguage = i18n.language?.split('-')[0] || 'en'

  // Determine which language to use for book names
  const bookNamesLanguage = useMemo(() => {
    if (!primaryTranslation) {
      return userLanguage
    }

    return normalizeLanguage(primaryTranslation.language, userLanguage)
  }, [primaryTranslation, userLanguage])

  // Get the bibleBooks data for the determined language
  const bibleBooks = useMemo(() => {
    return (
      BIBLE_BOOKS_BY_LANGUAGE[bookNamesLanguage] ||
      BIBLE_BOOKS_BY_LANGUAGE[userLanguage] ||
      BIBLE_BOOKS_BY_LANGUAGE.en
    )
  }, [bookNamesLanguage, userLanguage])

  /**
   * Get the localized book name for a given book code
   * Returns undefined if no translation is available (to indicate the book should be hidden)
   */
  const getBookName = useMemo(() => {
    return (bookCode: string): string | undefined => {
      const entry = bibleBooks[bookCode]
      return entry?.name
    }
  }, [bibleBooks])

  /**
   * Get the short/abbreviated book name for a given book code
   */
  const getShortBookName = useMemo(() => {
    return (bookCode: string): string | undefined => {
      const entry = bibleBooks[bookCode]
      return entry?.short
    }
  }, [bibleBooks])

  /**
   * Check if a book has a translation available
   */
  const hasBookTranslation = useMemo(() => {
    return (bookCode: string): boolean => {
      return !!bibleBooks[bookCode]?.name
    }
  }, [bibleBooks])

  return {
    getBookName,
    getShortBookName,
    hasBookTranslation,
    bookNamesLanguage,
    availableLanguages: Object.keys(BIBLE_BOOKS_BY_LANGUAGE),
  }
}
