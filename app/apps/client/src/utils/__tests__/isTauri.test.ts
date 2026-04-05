import { afterEach, describe, expect, it } from 'vitest'

import { isTauri } from '../isTauri'

describe('isTauri', () => {
  afterEach(() => {
    // Clean up __TAURI__ from window after each test
    if ('__TAURI__' in window) {
      // biome-ignore lint/performance/noDelete: test cleanup requires removing the property
      delete (window as Record<string, unknown>).__TAURI__
    }
  })

  it('returns false when __TAURI__ is not on window', () => {
    expect(isTauri()).toBe(false)
  })

  it('returns true when __TAURI__ is present on window', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    expect(isTauri()).toBe(true)
  })

  it('returns true even if __TAURI__ is a truthy non-object value', () => {
    ;(window as Record<string, unknown>).__TAURI__ = true
    expect(isTauri()).toBe(true)
  })

  it('returns true when __TAURI__ is set to an empty string (still "in" window)', () => {
    ;(window as Record<string, unknown>).__TAURI__ = ''
    // 'in' operator checks property existence, not truthiness
    expect(isTauri()).toBe(true)
  })

  it('returns true when __TAURI__ is undefined but property exists', () => {
    ;(window as Record<string, unknown>).__TAURI__ = undefined
    expect(isTauri()).toBe(true)
  })

  it('returns false after __TAURI__ is removed', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    expect(isTauri()).toBe(true)

    // biome-ignore lint/performance/noDelete: test requires removing the property
    delete (window as Record<string, unknown>).__TAURI__
    expect(isTauri()).toBe(false)
  })
})
