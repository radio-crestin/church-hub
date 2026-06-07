import { describe, expect, it } from 'vitest'

import { resolveAmen, resolveSongKey } from '../songElements'

describe('resolveSongKey', () => {
  it('returns the key only on the first slide', () => {
    expect(resolveSongKey(true, 'G', undefined)).toBe('G')
    expect(resolveSongKey(false, 'G', undefined)).toBeUndefined()
  })

  it('respects displayKeyLine=false', () => {
    expect(resolveSongKey(true, 'G', { displayKeyLine: false })).toBeUndefined()
    expect(resolveSongKey(true, 'G', { displayKeyLine: true })).toBe('G')
  })

  it('returns undefined when there is no key', () => {
    expect(resolveSongKey(true, null, undefined)).toBeUndefined()
    expect(resolveSongKey(true, '', undefined)).toBeUndefined()
    expect(resolveSongKey(true, '   ', undefined)).toBeUndefined()
  })

  it('trims the key value', () => {
    expect(resolveSongKey(true, '  Am  ', undefined)).toBe('Am')
  })
})

describe('resolveAmen', () => {
  it('returns "Amin!" only on the last slide', () => {
    expect(resolveAmen(true, 'Slăvit să fie El!')).toBe('Amin!')
    expect(resolveAmen(false, 'Slăvit să fie El!')).toBeUndefined()
  })

  it('is suppressed when the slide already contains "amin" (any case)', () => {
    expect(resolveAmen(true, 'Amin, Amin!')).toBeUndefined()
    expect(resolveAmen(true, '<p>amin</p>')).toBeUndefined()
    expect(resolveAmen(true, 'AMIN')).toBeUndefined()
  })
})
