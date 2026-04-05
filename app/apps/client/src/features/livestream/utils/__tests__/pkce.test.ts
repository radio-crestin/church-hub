import { describe, expect, it } from 'vitest'

import {
  buildAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
} from '../pkce'

describe('livestream/utils/pkce', () => {
  describe('generateCodeVerifier', () => {
    it('generates a non-empty string', () => {
      const verifier = generateCodeVerifier()
      expect(verifier).toBeTruthy()
      expect(typeof verifier).toBe('string')
    })

    it('generates a string with valid base64url characters', () => {
      const verifier = generateCodeVerifier()
      // base64url: A-Z, a-z, 0-9, -, _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('generates a string of minimum PKCE length (43+)', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
    })

    it('generates unique values on each call', () => {
      const v1 = generateCodeVerifier()
      const v2 = generateCodeVerifier()
      expect(v1).not.toBe(v2)
    })
  })

  describe('generateCodeChallenge', () => {
    it('generates a non-empty challenge from a verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      expect(challenge).toBeTruthy()
      expect(typeof challenge).toBe('string')
    })

    it('generates base64url encoded output', async () => {
      const challenge = await generateCodeChallenge('test-verifier-string')
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('produces different challenges for different verifiers', async () => {
      const c1 = await generateCodeChallenge('verifier-one')
      const c2 = await generateCodeChallenge('verifier-two')
      expect(c1).not.toBe(c2)
    })

    it('produces the same challenge for the same verifier', async () => {
      const c1 = await generateCodeChallenge('same-verifier')
      const c2 = await generateCodeChallenge('same-verifier')
      expect(c1).toBe(c2)
    })
  })

  describe('buildAuthUrl', () => {
    it('builds a valid Google OAuth URL', () => {
      const url = buildAuthUrl({
        clientId: 'client123',
        redirectUri: 'http://localhost:3000/callback',
        codeChallenge: 'challenge_abc',
        scope: 'https://www.googleapis.com/auth/youtube',
      })

      const parsed = new URL(url)
      expect(parsed.hostname).toBe('accounts.google.com')
      expect(parsed.pathname).toBe('/o/oauth2/v2/auth')
      expect(parsed.searchParams.get('client_id')).toBe('client123')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/callback',
      )
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('scope')).toBe(
        'https://www.googleapis.com/auth/youtube',
      )
      expect(parsed.searchParams.get('code_challenge')).toBe('challenge_abc')
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
      expect(parsed.searchParams.get('access_type')).toBe('offline')
      expect(parsed.searchParams.get('prompt')).toBe('consent')
    })

    it('includes state parameter when provided', () => {
      const url = buildAuthUrl({
        clientId: 'client123',
        redirectUri: 'http://localhost:3000/callback',
        codeChallenge: 'challenge',
        scope: 'scope',
        state: 'my-state-123',
      })

      const parsed = new URL(url)
      expect(parsed.searchParams.get('state')).toBe('my-state-123')
    })

    it('does not include state parameter when not provided', () => {
      const url = buildAuthUrl({
        clientId: 'client123',
        redirectUri: 'http://localhost:3000/callback',
        codeChallenge: 'challenge',
        scope: 'scope',
      })

      const parsed = new URL(url)
      expect(parsed.searchParams.has('state')).toBe(false)
    })
  })
})
