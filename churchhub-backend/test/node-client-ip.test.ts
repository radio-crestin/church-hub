import { describe, expect, test } from 'bun:test'
import { createCidrMatcher } from '../src/node/createCidrMatcher'
import { resolveClientIp } from '../src/node/resolveClientIp'
import { withClientIp } from '../src/node/withClientIp'

// Our ingress pods, plus an outer proxy's ranges (documentation prefixes).
const trusted = createCidrMatcher('10.1.0.0/16, fd00:42::/56, 192.0.2.0/24, 2001:db8:cf::/48')
const resolve = (peer: string, forwardedFor: string | null) =>
  resolveClientIp({ peer, forwardedFor, isTrustedProxy: trusted })

describe('createCidrMatcher', () => {
  test('matches IPv4, IPv6 and IPv4-mapped peers inside the ranges only', () => {
    expect(trusted('10.1.3.4')).toBe(true)
    expect(trusted('::ffff:10.1.3.4')).toBe(true)
    expect(trusted('10.43.0.1')).toBe(false)
    expect(trusted('fd00:42::1')).toBe(true)
    expect(trusted('fd00:43::1')).toBe(false)
    expect(trusted('not an ip')).toBe(false)
  })

  test('an empty list trusts nobody; a malformed entry throws', () => {
    expect(createCidrMatcher('')('10.0.0.1')).toBe(false)
    expect(() => createCidrMatcher('10.0.0.0/33')).toThrow()
    expect(() => createCidrMatcher('nonsense')).toThrow()
  })
})

describe('resolveClientIp', () => {
  test('ignores X-Forwarded-For from an untrusted peer', () => {
    expect(resolve('203.0.113.9', '198.51.100.1')).toBe('203.0.113.9')
  })

  test('takes the right-most untrusted entry behind the ingress alone', () => {
    expect(resolve('10.1.0.7', '198.51.100.1')).toBe('198.51.100.1')
  })

  test('skips the outer proxy the ingress trusts', () => {
    // visitor (written by the outer proxy), outer proxy's edge (by the ingress)
    expect(resolve('10.1.0.7', '198.51.100.1, 192.0.2.10')).toBe('198.51.100.1')
  })

  test('a forged prefix never wins, however many entries it adds', () => {
    expect(resolve('10.1.0.7', '6.6.6.6, 7.7.7.7, 198.51.100.1, 192.0.2.10')).toBe('198.51.100.1')
    expect(resolve('10.1.0.7', '192.0.2.99, 198.51.100.1, 192.0.2.10')).toBe('198.51.100.1')
  })

  test('a malformed entry falls back to the peer', () => {
    expect(resolve('10.1.0.7', '198.51.100.1, garbage')).toBe('10.1.0.7')
    expect(resolve('10.1.0.7', 'unknown')).toBe('10.1.0.7')
  })

  test('IPv6 and IPv4-mapped forms', () => {
    expect(resolve('::ffff:10.1.0.7', '2001:db8:1::5, 2001:db8:cf::1')).toBe('2001:db8:1::5')
    expect(resolve('10.1.0.7', '::ffff:198.51.100.1')).toBe('198.51.100.1')
    expect(resolve('fd00:42::9', '198.51.100.1')).toBe('198.51.100.1')
  })

  test('without a header the peer is the client, IPv4-mapped normalised', () => {
    expect(resolve('::ffff:10.1.0.7', null)).toBe('10.1.0.7')
  })

  test('a request from inside (every hop trusted) is its farthest hop', () => {
    expect(resolve('10.1.0.7', '10.1.5.5')).toBe('10.1.5.5')
  })
})

describe('withClientIp', () => {
  test('replaces a spoofed CF-Connecting-IP and keeps the body', async () => {
    const request = new Request('http://backend/sync/churches', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '9.9.9.9', 'Content-Type': 'application/json' },
      body: '{"a":1}',
    })
    const rewritten = withClientIp(request, '198.51.100.1')
    expect(rewritten.headers.get('CF-Connecting-IP')).toBe('198.51.100.1')
    expect(await rewritten.json()).toEqual({ a: 1 })
  })
})
