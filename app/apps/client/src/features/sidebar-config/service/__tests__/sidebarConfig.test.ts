import { describe, expect, it } from 'vitest'

import { generateCustomPageId, getCustomPagePermission } from '../sidebarConfig'

// We test the pure utility functions that don't require mocking settings service
describe('sidebar-config/service/sidebarConfig', () => {
  describe('generateCustomPageId', () => {
    it('generates a string starting with "custom_"', () => {
      const id = generateCustomPageId()
      expect(id).toMatch(/^custom_/)
    })

    it('generates unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateCustomPageId())
      }
      expect(ids.size).toBe(100)
    })

    it('includes a timestamp component', () => {
      const id = generateCustomPageId()
      // Format: custom_<timestamp>_<random>
      const parts = id.split('_')
      expect(parts).toHaveLength(3)
      const timestamp = Number(parts[1])
      expect(timestamp).toBeGreaterThan(0)
    })
  })

  describe('getCustomPagePermission', () => {
    it('generates permission key for a page', () => {
      const result = getCustomPagePermission('my-page')
      expect(result).toBe('custom_page.my-page.view')
    })

    it('handles page IDs with underscores', () => {
      const result = getCustomPagePermission('custom_12345_abc')
      expect(result).toBe('custom_page.custom_12345_abc.view')
    })
  })
})
