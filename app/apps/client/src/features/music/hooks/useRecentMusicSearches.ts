import { useCallback, useState } from 'react'

const STORAGE_KEY = 'music.recentSearches'
const MAX_SEARCHES = 5

function readSearches(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored)
      ? stored.filter((s) => typeof s === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * The last searches on the Music page, newest first. Per device, like the
 * page's other preferences: they belong to whoever works at this machine.
 */
export function useRecentMusicSearches() {
  const [searches, setSearches] = useState(readSearches)

  const remember = useCallback((search: string) => {
    const query = search.trim()
    if (query.length < 2) return
    setSearches((current) => {
      const next = [
        query,
        ...current.filter((s) => s.toLowerCase() !== query.toLowerCase()),
      ].slice(0, MAX_SEARCHES)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { searches, remember }
}
