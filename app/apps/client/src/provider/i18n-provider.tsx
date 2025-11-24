import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getLanguagePreference,
  type Language,
  type LanguagePreference,
  resolveLanguage,
  saveLanguagePreference,
} from '../service/locale'

interface I18nContextType {
  language: Language
  preference: LanguagePreference
  setLanguagePreference: (preference: LanguagePreference) => Promise<void>
  isLoading: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [preference, setPreference] = useState<LanguagePreference>('system')
  const [language, setLanguage] = useState<Language>('en')
  const [isLoading, setIsLoading] = useState(true)

  // Load language preference on mount
  useEffect(() => {
    async function loadLanguagePreference() {
      try {
        const savedPreference = await getLanguagePreference()
        const effectivePreference = savedPreference || 'system'
        const effectiveLanguage = resolveLanguage(effectivePreference)

        setPreference(effectivePreference)
        setLanguage(effectiveLanguage)

        // Update i18next language
        await i18n.changeLanguage(effectiveLanguage)
      } catch (_error) {
        // Fallback to system language
        const systemLang = resolveLanguage('system')
        setLanguage(systemLang)
        await i18n.changeLanguage(systemLang)
      } finally {
        setIsLoading(false)
      }
    }

    loadLanguagePreference()
  }, [i18n])

  const setLanguagePreference = async (newPreference: LanguagePreference) => {
    try {
      // Resolve the actual language
      const effectiveLanguage = resolveLanguage(newPreference)

      // Save to database
      const success = await saveLanguagePreference(newPreference)

      if (success) {
        // Update state
        setPreference(newPreference)
        setLanguage(effectiveLanguage)

        // Update i18next language
        await i18n.changeLanguage(effectiveLanguage)

        // Also update localStorage for i18next browser language detector
        localStorage.setItem('church-hub-language', effectiveLanguage)
      } else {
      }
    } catch (_error) {}
  }

  return (
    <I18nContext.Provider
      value={{ language, preference, setLanguagePreference, isLoading }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
