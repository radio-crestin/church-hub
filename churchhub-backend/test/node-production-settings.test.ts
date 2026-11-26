import { describe, expect, test } from 'bun:test'

import { assertProductionSettings } from '../src/node/assertProductionSettings'

const production = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://redis.test:6379',
  TRUSTED_PROXY_CIDRS: '192.0.2.0/24',
}

describe('assertProductionSettings', () => {
  test('accepts a complete production configuration', () => {
    expect(() => assertProductionSettings(production)).not.toThrow()
  })

  test('requires REDIS_URL in production', () => {
    expect(() =>
      assertProductionSettings({ ...production, REDIS_URL: undefined }),
    ).toThrow('REDIS_URL')
  })

  test('a single instance runs in production without Redis', () => {
    expect(() =>
      assertProductionSettings({ ...production, REDIS_URL: undefined, SINGLE_INSTANCE: 'true' }),
    ).not.toThrow()
  })

  test('anything but SINGLE_INSTANCE=true still requires REDIS_URL', () => {
    for (const value of ['', 'false', '1', 'yes']) {
      expect(() =>
        assertProductionSettings({ ...production, REDIS_URL: undefined, SINGLE_INSTANCE: value }),
      ).toThrow('REDIS_URL')
    }
  })

  test('requires TRUSTED_PROXY_CIDRS in production, blank counts as unset', () => {
    for (const value of [undefined, '', '   ']) {
      expect(() =>
        assertProductionSettings({ ...production, TRUSTED_PROXY_CIDRS: value }),
      ).toThrow('TRUSTED_PROXY_CIDRS')
    }
  })

  test('leaves development alone', () => {
    expect(() => assertProductionSettings({ NODE_ENV: 'development' })).not.toThrow()
  })
})
