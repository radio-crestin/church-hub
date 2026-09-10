import { describe, expect, it } from 'vitest'

import { shouldRecoverTitles } from '../shouldRecoverTitles'

const DAY = 1000 * 60 * 60 * 24
const NOW = 1_700_000_000_000

const decide = (
  overrides: Partial<Parameters<typeof shouldRecoverTitles>[0]>,
) =>
  shouldRecoverTitles({
    recoveredSignature: null,
    nextSignature: 'etag-1',
    attemptedAt: 0,
    now: NOW,
    gapMs: DAY,
    ...overrides,
  })

describe('shouldRecoverTitles', () => {
  it('recovers on the first launch, even though the catalogue is unchanged', () => {
    // Nothing has ever been recovered, so the unchanged catalogue is still
    // worth downloading once.
    expect(decide({})).toBe(true)
  })

  it('does nothing once the names came from this very catalogue', () => {
    expect(decide({ recoveredSignature: 'etag-1' })).toBe(false)
  })

  it('recovers again when the catalogue has moved on', () => {
    expect(
      decide({ recoveredSignature: 'etag-0', attemptedAt: NOW - 2 * DAY }),
    ).toBe(true)
  })

  it('does not retry a failed attempt on the next launch', () => {
    // The attempt was minutes ago and left nothing recovered: retrying now
    // would download the whole catalogue again for nothing.
    expect(decide({ attemptedAt: NOW - 1000 * 60 * 5 })).toBe(false)
  })

  it('retries a failed attempt once the day is up', () => {
    expect(decide({ attemptedAt: NOW - DAY })).toBe(true)
  })

  it('stays quiet when a changed catalogue was only just attempted', () => {
    expect(
      decide({
        recoveredSignature: 'etag-0',
        attemptedAt: NOW - 1000 * 60 * 60,
      }),
    ).toBe(false)
  })

  it('treats a source with no validator as one more thing to recover from', () => {
    // An empty signature is still a value: recovering against it once is
    // better than never recovering at all.
    expect(decide({ nextSignature: '', recoveredSignature: null })).toBe(true)
    expect(decide({ nextSignature: '', recoveredSignature: '' })).toBe(false)
  })
})
