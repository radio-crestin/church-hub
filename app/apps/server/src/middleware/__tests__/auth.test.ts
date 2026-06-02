import { describe, expect, it, mock } from 'bun:test'
import { adminOnlyMiddleware, authMiddleware, parseCookies } from '../auth'

// Mock dependencies
mock.module('../../service/app-sessions', () => ({
  validateSystemToken: async (token: string) => token === 'valid-system-token',
}))

mock.module('../../service/users', () => ({
  getUserByToken: async (token: string) => {
    if (token === 'valid-user-token') {
      return {
        id: 1,
        name: 'Test User',
        isActive: true,
        permissions: ['songs.view', 'songs.create'],
      }
    }
    if (token === 'inactive-user-token') {
      return {
        id: 2,
        name: 'Inactive User',
        isActive: false,
        permissions: [],
      }
    }
    return null
  },
  updateUserLastUsed: (_id: number) => {},
}))

function createRequest(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers })
}

describe('parseCookies', () => {
  it('returns empty object for empty string', () => {
    expect(parseCookies('')).toEqual({})
  })

  it('parses single cookie', () => {
    expect(parseCookies('user_auth=abc123')).toEqual({ user_auth: 'abc123' })
  })

  it('parses multiple cookies', () => {
    const result = parseCookies('user_auth=abc123; session=xyz789; theme=dark')
    expect(result).toEqual({
      user_auth: 'abc123',
      session: 'xyz789',
      theme: 'dark',
    })
  })

  it('handles cookies with = in value', () => {
    const result = parseCookies('token=abc=def=ghi')
    expect(result).toEqual({ token: 'abc=def=ghi' })
  })

  it('trims whitespace from keys and values', () => {
    const result = parseCookies('  user_auth = abc123 ;  session = xyz ')
    expect(result).toEqual({ user_auth: 'abc123', session: 'xyz' })
  })

  it('handles empty cookie value', () => {
    const result = parseCookies('key=')
    expect(result).toEqual({ key: '' })
  })
})

describe('authMiddleware', () => {
  describe('localhost access', () => {
    it('grants read-only display access for localhost Host header', async () => {
      const req = createRequest('http://localhost:3000/api/songs', {
        Host: 'localhost:3000',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context).not.toBeNull()
      // localhost no longer auto-grants admin: cookie-less local display
      // surfaces get a view-only user context, never write/admin access.
      expect(result.context!.authType).toBe('user')
      expect(result.context!.permissions).toContain('songs.view')
      expect(result.context!.permissions).not.toContain('songs.create')
    })

    it('grants read-only display access for 127.0.0.1 Host header', async () => {
      const req = createRequest('http://127.0.0.1:3000/api/songs', {
        Host: '127.0.0.1:3000',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('user')
      expect(result.context!.permissions).not.toContain('songs.create')
    })

    it('grants read-only display access for 127.x.x.x ranges', async () => {
      const req = createRequest('http://127.0.0.2:3000/api/songs', {
        Host: '127.0.0.2:3000',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('user')
      expect(result.context!.permissions).not.toContain('songs.create')
    })

    it('grants read-only display access when Host resolves to localhost', async () => {
      // Create request without Host header - the constructor auto-adds one
      // so we need to verify the behavior when Host resolves to localhost
      const req = createRequest('http://localhost:3000/api/songs', {
        Host: 'localhost',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('user')
      expect(result.context!.permissions).not.toContain('songs.create')
    })
  })

  describe('system token authentication', () => {
    it('grants app access for valid system token', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
        Authorization: 'Bearer valid-system-token',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('app')
    })

    it('rejects invalid system token and falls through to cookie auth', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
        Authorization: 'Bearer invalid-token',
      })
      const result = await authMiddleware(req)
      // No valid cookie either, so should return 401
      expect(result.response).not.toBeNull()
      expect(result.response!.status).toBe(401)
    })
  })

  describe('cookie authentication (remote access)', () => {
    it('authenticates valid user token from cookie', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
        Cookie: 'user_auth=valid-user-token',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context).not.toBeNull()
      expect(result.context!.authType).toBe('user')
      expect(result.context!.userId).toBe(1)
      expect(result.context!.permissions).toEqual([
        'songs.view',
        'songs.create',
      ])
    })

    it('rejects inactive user token', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
        Cookie: 'user_auth=inactive-user-token',
      })
      const result = await authMiddleware(req)
      expect(result.response).not.toBeNull()
      expect(result.response!.status).toBe(401)
    })

    it('rejects unknown user token', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
        Cookie: 'user_auth=unknown-token',
      })
      const result = await authMiddleware(req)
      expect(result.response).not.toBeNull()
      expect(result.response!.status).toBe(401)
    })

    it('returns 401 when no authentication is provided for remote access', async () => {
      const req = createRequest('http://remote-host:3000/api/songs', {
        Host: 'remote-host:3000',
      })
      const result = await authMiddleware(req)
      expect(result.response).not.toBeNull()
      expect(result.response!.status).toBe(401)
      const body = await result.response!.json()
      expect(body.error).toBe('Unauthorized')
    })
  })

  describe('localhost detection via Origin header', () => {
    it('detects localhost from Origin header', async () => {
      const req = createRequest('http://192.168.1.100:3000/api/songs', {
        Host: '192.168.1.100:3000',
        Origin: 'http://localhost:8080',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('user')
    })

    it('detects 127.0.0.1 from Origin header', async () => {
      const req = createRequest('http://192.168.1.100:3000/api/songs', {
        Host: '192.168.1.100:3000',
        Origin: 'http://127.0.0.1:3000',
      })
      const result = await authMiddleware(req)
      expect(result.response).toBeNull()
      expect(result.context!.authType).toBe('user')
    })
  })
})

describe('adminOnlyMiddleware', () => {
  it('denies access for localhost without an admin session', async () => {
    const req = createRequest('http://localhost:3000/api/admin', {
      Host: 'localhost:3000',
    })
    const result = await adminOnlyMiddleware(req)
    // localhost is no longer auto-admin — only a super-admin session or the
    // system token reaches admin routes.
    expect(result.response).not.toBeNull()
    expect(result.response!.status).toBe(403)
  })

  it('grants access for valid system token', async () => {
    const req = createRequest('http://remote-host:3000/api/admin', {
      Host: 'remote-host:3000',
      Authorization: 'Bearer valid-system-token',
    })
    const result = await adminOnlyMiddleware(req)
    expect(result.response).toBeNull()
    expect(result.context!.authType).toBe('app')
  })

  it('denies access for remote without system token', async () => {
    const req = createRequest('http://remote-host:3000/api/admin', {
      Host: 'remote-host:3000',
    })
    const result = await adminOnlyMiddleware(req)
    expect(result.response).not.toBeNull()
    // Unauthenticated remote requests are rejected at the auth layer (401)
    // before the admin check runs.
    expect(result.response!.status).toBe(401)
    const body = await result.response!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('denies access for remote with user cookie (not admin)', async () => {
    const req = createRequest('http://remote-host:3000/api/admin', {
      Host: 'remote-host:3000',
      Cookie: 'user_auth=valid-user-token',
    })
    const result = await adminOnlyMiddleware(req)
    expect(result.response).not.toBeNull()
    expect(result.response!.status).toBe(403)
  })

  it('denies access for invalid system token', async () => {
    const req = createRequest('http://remote-host:3000/api/admin', {
      Host: 'remote-host:3000',
      Authorization: 'Bearer bad-token',
    })
    const result = await adminOnlyMiddleware(req)
    expect(result.response).not.toBeNull()
    // Invalid credentials fall through to the 401 unauthenticated response.
    expect(result.response!.status).toBe(401)
  })
})
