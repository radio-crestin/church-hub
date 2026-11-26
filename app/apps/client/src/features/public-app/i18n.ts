import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import publicAppEN from '~/i18n/locales/en/publicApp.json'
import publicAppRO from '~/i18n/locales/ro/publicApp.json'

/**
 * The public app's own i18next: only its namespace, so its download stays
 * small. Same language detection as the desktop app.
 */
export function initPublicI18n() {
  return i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { publicApp: publicAppEN },
        ro: { publicApp: publicAppRO },
      },
      fallbackLng: 'en',
      defaultNS: 'publicApp',
      ns: ['publicApp'],
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'church-hub-language',
      },
      interpolation: { escapeValue: false },
    })
}
