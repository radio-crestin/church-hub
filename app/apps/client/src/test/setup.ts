import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Node 25+ defines its own localStorage/sessionStorage globals (undefined
// without --localstorage-file). Vitest 3 keeps Node's over jsdom's, so point
// both back at jsdom's real Storage objects.
const { jsdom } = globalThis as unknown as { jsdom: { window: Window } }
for (const storage of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, storage, {
    value: jsdom.window[storage],
    configurable: true,
    writable: true,
  })
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock dialog element methods
HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()
