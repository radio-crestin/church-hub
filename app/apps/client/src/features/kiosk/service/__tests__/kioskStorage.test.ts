import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KioskSettings } from '../../types'
import {
  clearKioskSettings,
  getKioskSettings,
  STORAGE_KEY,
  setKioskSettings,
  updateKioskSettings,
} from '../kioskStorage'

// jsdom localStorage mock doesn't have clear(), so we use a manual store
const storageStore: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => storageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storageStore[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete storageStore[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(storageStore)) {
      delete storageStore[key]
    }
  }),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('kiosk/service/kioskStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  const defaultSettings: KioskSettings = {
    enabled: false,
    startupPage: { type: 'route', path: '/present' },
  }

  describe('getKioskSettings', () => {
    it('returns default settings when nothing stored', () => {
      const result = getKioskSettings()
      expect(result).toEqual(defaultSettings)
    })

    it('returns stored settings', () => {
      const settings: KioskSettings = {
        enabled: true,
        startupPage: { type: 'route', path: '/bible' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      const result = getKioskSettings()
      expect(result).toEqual(settings)
    })

    it('returns default when stored JSON is invalid', () => {
      localStorage.setItem(STORAGE_KEY, 'not json')
      const result = getKioskSettings()
      expect(result).toEqual(defaultSettings)
    })

    it('returns default when enabled is not boolean', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: 'yes',
          startupPage: { type: 'route', path: '/' },
        }),
      )
      const result = getKioskSettings()
      expect(result).toEqual(defaultSettings)
    })

    it('uses default startupPage when stored one is invalid', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true }))
      const result = getKioskSettings()
      expect(result.startupPage).toEqual(defaultSettings.startupPage)
    })

    it('uses default startupPage when type is missing', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: false,
          startupPage: { path: '/songs' },
        }),
      )
      const result = getKioskSettings()
      expect(result.startupPage).toEqual(defaultSettings.startupPage)
    })
  })

  describe('setKioskSettings', () => {
    it('stores settings in localStorage', () => {
      const settings: KioskSettings = {
        enabled: true,
        startupPage: { type: 'route', path: '/songs' },
      }
      setKioskSettings(settings)
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored).toEqual(settings)
    })
  })

  describe('updateKioskSettings', () => {
    it('merges partial settings with current', () => {
      const result = updateKioskSettings({ enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.startupPage).toEqual(defaultSettings.startupPage)
    })

    it('stores the updated settings', () => {
      updateKioskSettings({ enabled: true })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.enabled).toBe(true)
    })

    it('returns the merged settings', () => {
      setKioskSettings({
        enabled: false,
        startupPage: { type: 'route', path: '/bible' },
      })
      const result = updateKioskSettings({ enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.startupPage).toEqual({ type: 'route', path: '/bible' })
    })
  })

  describe('clearKioskSettings', () => {
    it('removes settings from localStorage', () => {
      setKioskSettings({
        enabled: true,
        startupPage: { type: 'route', path: '/songs' },
      })
      clearKioskSettings()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('restores defaults after clearing', () => {
      setKioskSettings({
        enabled: true,
        startupPage: { type: 'route', path: '/songs' },
      })
      clearKioskSettings()
      expect(getKioskSettings()).toEqual(defaultSettings)
    })
  })

  describe('STORAGE_KEY', () => {
    it('is the expected key', () => {
      expect(STORAGE_KEY).toBe('church-hub-kiosk-settings')
    })
  })
})
