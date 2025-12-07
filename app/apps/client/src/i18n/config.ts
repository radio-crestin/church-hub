import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Import translation files
import commonEN from './locales/en/common.json'
import presentationEN from './locales/en/presentation.json'
import programsEN from './locales/en/programs.json'
import queueEN from './locales/en/queue.json'
import settingsEN from './locales/en/settings.json'
import sidebarEN from './locales/en/sidebar.json'
import songsEN from './locales/en/songs.json'
import commonRO from './locales/ro/common.json'
import presentationRO from './locales/ro/presentation.json'
import programsRO from './locales/ro/programs.json'
import queueRO from './locales/ro/queue.json'
import settingsRO from './locales/ro/settings.json'
import sidebarRO from './locales/ro/sidebar.json'
import songsRO from './locales/ro/songs.json'

// Define resources type for type safety
export const resources = {
  en: {
    common: commonEN,
    presentation: presentationEN,
    programs: programsEN,
    queue: queueEN,
    sidebar: sidebarEN,
    settings: settingsEN,
    songs: songsEN,
  },
  ro: {
    common: commonRO,
    presentation: presentationRO,
    programs: programsRO,
    queue: queueRO,
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
      'common',
      'presentation',
      'programs',
      'queue',
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
