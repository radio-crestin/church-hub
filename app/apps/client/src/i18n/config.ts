import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Import translation files
import bibleEN from './locales/en/bible.json'
import bibleBooksEN from './locales/en/bibleBooks.json'
import commonEN from './locales/en/common.json'
import livestreamEN from './locales/en/livestream.json'
import presentationEN from './locales/en/presentation.json'
import queueEN from './locales/en/queue.json'
import schedulesEN from './locales/en/schedules.json'
import settingsEN from './locales/en/settings.json'
import sidebarEN from './locales/en/sidebar.json'
import songsEN from './locales/en/songs.json'
import bibleRO from './locales/ro/bible.json'
import bibleBooksRO from './locales/ro/bibleBooks.json'
import commonRO from './locales/ro/common.json'
import livestreamRO from './locales/ro/livestream.json'
import presentationRO from './locales/ro/presentation.json'
import queueRO from './locales/ro/queue.json'
import schedulesRO from './locales/ro/schedules.json'
import settingsRO from './locales/ro/settings.json'
import sidebarRO from './locales/ro/sidebar.json'
import songsRO from './locales/ro/songs.json'

// Define resources type for type safety
export const resources = {
  en: {
    bible: bibleEN,
    bibleBooks: bibleBooksEN,
    common: commonEN,
    livestream: livestreamEN,
    presentation: presentationEN,
    queue: queueEN,
    schedules: schedulesEN,
    sidebar: sidebarEN,
    settings: settingsEN,
    songs: songsEN,
  },
  ro: {
    bible: bibleRO,
    bibleBooks: bibleBooksRO,
    common: commonRO,
    livestream: livestreamRO,
    presentation: presentationRO,
    queue: queueRO,
    schedules: schedulesRO,
    sidebar: sidebarRO,
    settings: settingsRO,
    songs: songsRO,
  },
} as const

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Fallback language
    defaultNS: 'common', // Default namespace
    ns: [
      'bible',
      'bibleBooks',
      'common',
      'livestream',
      'presentation',
      'queue',
      'schedules',
      'sidebar',
      'settings',
      'songs',
    ], // Available namespaces

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator'], // Check localStorage first, then browser settings
      caches: ['localStorage'], // Cache user's language choice
      lookupLocalStorage: 'church-hub-language',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: true, // Enable Suspense for async loading
    },
  })

export default i18n
