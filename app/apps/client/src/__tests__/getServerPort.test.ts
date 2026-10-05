import { afterEach, describe, expect, it, vi } from 'vitest'

import { getServerPort } from '../config'

describe('getServerPort', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { __serverConfig?: unknown }).__serverConfig
  })

  it('uses 3001 in development, never the installed app port 3000', () => {
    vi.stubEnv('VITE_SERVER_PORT', '')
    vi.stubEnv('VITE_API_PORT', '')
    vi.stubEnv('DEV', true)
    expect(getServerPort()).toBe(3001)
  })

  it('uses 3000 in a packaged build', () => {
    vi.stubEnv('VITE_SERVER_PORT', '')
    vi.stubEnv('VITE_API_PORT', '')
    vi.stubEnv('DEV', false)
    expect(getServerPort()).toBe(3000)
  })

  it('prefers a port baked into the build (worktrees, review builds)', () => {
    vi.stubEnv('VITE_SERVER_PORT', '4196')
    expect(getServerPort()).toBe(4196)
  })

  it('prefers the port the desktop shell reports', () => {
    vi.stubEnv('VITE_SERVER_PORT', '4196')
    window.__serverConfig = { serverPort: 3002 }
    expect(getServerPort()).toBe(3002)
  })
})
