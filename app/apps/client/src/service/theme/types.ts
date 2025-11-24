/**
 * Supported themes in the application
 */
export type Theme = 'light' | 'dark'

/**
 * Theme preference options
 * - 'system': Use operating system theme preference
 * - Theme: Explicitly selected theme
 */
export type ThemePreference = 'system' | Theme

/**
 * Theme display information
 */
export interface ThemeOption {
  code: ThemePreference
  label: string
  icon?: string
}
