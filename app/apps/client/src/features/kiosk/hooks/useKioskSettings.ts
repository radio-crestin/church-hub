import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  getKioskSettings,
  STORAGE_KEY,
  updateKioskSettings,
} from '../service/kioskStorage'
import type { KioskSettings } from '../types'

const QUERY_KEY = ['kiosk-settings']

/**
 * React Query hook for reading kiosk settings from localStorage
 * Uses staleTime: Infinity since data is local and never "stale"
 */
export function useKioskSettings() {
  const queryClient = useQueryClient()

  // Listen for storage events (cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [queryClient])

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: (): KioskSettings => {
      // Synchronous read from localStorage
      return getKioskSettings()
    },
    staleTime: Infinity, // Never stale - local storage doesn't change externally
  })
}

/**
 * Mutation hook for updating kiosk settings in localStorage
 */
export function useUpdateKioskSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<KioskSettings>) => {
      // Synchronous update to localStorage
      updateKioskSettings(settings)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * Synchronous function to get kiosk settings (for use outside React components)
 * Use this in route beforeLoad handlers
 */
export function getKioskSettingsSync(): KioskSettings {
  return getKioskSettings()
}
