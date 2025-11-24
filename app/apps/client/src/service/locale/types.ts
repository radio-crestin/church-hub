/**
 * Supported languages in the application
 */
export type Language = 'en' | 'ro'

/**
 * Language preference options
 * - 'system': Use operating system language
 * - Language code: Explicitly selected language
 */
export type LanguagePreference = 'system' | Language

/**
 * Language display information
 */
export interface LanguageOption {
  code: LanguagePreference
  label: string
  nativeLabel: string
}
