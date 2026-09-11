import { describe, expect, it } from 'vitest'

import { compareVersions } from '../compareVersions'

describe('compareVersions', () => {
  it('orders release versions numerically, not as strings', () => {
    expect(compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.1.0')).toBeGreaterThan(0)
    expect(compareVersions('1.2.1', '1.2.0')).toBeGreaterThan(0)
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('tolerates a leading v and a missing patch', () => {
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('V1.3', 'v1.2.9')).toBeGreaterThan(0)
  })

  it('puts a pre-release before the release it leads up to', () => {
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBeLessThan(0)
    expect(compareVersions('1.2.0', '1.2.0-rc.3')).toBeGreaterThan(0)
    // Still newer than the previous release.
    expect(compareVersions('1.2.0-beta.1', '1.1.9')).toBeGreaterThan(0)
  })

  it('compares pre-release identifiers the semver way', () => {
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBeLessThan(0)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta', '1.0.0-beta.1')).toBeLessThan(0)
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0)
    expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0)
  })

  it('ignores build metadata', () => {
    expect(compareVersions('1.0.0+build.5', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.1+a', '1.0.0+b')).toBeGreaterThan(0)
  })

  it('never produces NaN for odd input', () => {
    expect(Number.isNaN(compareVersions('1.2.0-beta.2', '1.2.0'))).toBe(false)
    expect(Number.isNaN(compareVersions('garbage', '1.0.0'))).toBe(false)
    expect(compareVersions('garbage', '0.0.0')).toBe(0)
  })
})
