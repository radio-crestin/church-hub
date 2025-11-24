import { createContext, useContext, useEffect, useState } from 'react'

import {
  detectSystemTheme,
  getThemePreference,
  resolveTheme,
  saveThemePreference,
  type Theme,
  type ThemePreference,
} from '../service/theme'

interface ThemeContextType {
  theme: Theme
  preference: ThemePreference
  setThemePreference: (preference: ThemePreference) => Promise<void>
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system')
  const [theme, setTheme] = useState<Theme>('dark')
  const [isLoading, setIsLoading] = useState(true)

  // Load theme preference on mount
  useEffect(() => {
    async function loadThemePreference() {
      try {
        const savedPreference = await getThemePreference()
        const effectivePreference = savedPreference || 'system'
        const effectiveTheme = resolveTheme(effectivePreference)

        setPreference(effectivePreference)
        setTheme(effectiveTheme)
      } catch (_error) {
        // Fallback to system theme
        const systemTheme = detectSystemTheme()
        setTheme(systemTheme)
      } finally {
        setIsLoading(false)
      }
    }

    loadThemePreference()
  }, [])

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.classList.remove('light', 'dark')
    root.classList.add(theme)

    body.classList.remove('light', 'dark')
    body.classList.add(theme)

    // Also update localStorage for offline support
    localStorage.setItem('church-hub-theme', theme)
  }, [theme])

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light'
      setTheme(newTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [preference])

  const setThemePreference = async (newPreference: ThemePreference) => {
    try {
      // Resolve the actual theme
      const effectiveTheme = resolveTheme(newPreference)

      // Save to database
      const success = await saveThemePreference(newPreference)

      if (success) {
        // Update state
        setPreference(newPreference)
        setTheme(effectiveTheme)
      } else {
      }
    } catch (_error) {}
  }

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setThemePreference, isLoading }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
