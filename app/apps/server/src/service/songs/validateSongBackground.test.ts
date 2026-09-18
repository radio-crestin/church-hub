import { validateSongBackground } from './validateSongBackground'
import { describe, expect, test } from 'bun:test'

describe('validateSongBackground', () => {
  test('accepts undefined (unchanged) and null (clear)', () => {
    expect(validateSongBackground(undefined)).toBeNull()
    expect(validateSongBackground(null)).toBeNull()
  })

  test('accepts every background type with an opacity in [0, 1]', () => {
    expect(validateSongBackground({ type: 'transparent', opacity: 0 })).toBe(
      null,
    )
    expect(
      validateSongBackground({ type: 'color', color: '#112233', opacity: 1 }),
    ).toBeNull()
    expect(
      validateSongBackground({
        type: 'image',
        imageUrl: '/api/media/backgrounds/a.png',
        opacity: 0.5,
      }),
    ).toBeNull()
    expect(
      validateSongBackground({
        type: 'video',
        videoUrl: '/api/media/backgrounds/b.mp4',
        opacity: 0.25,
      }),
    ).toBeNull()
  })

  test('rejects values that are not a plain object', () => {
    for (const value of ['color', 42, true, [], [{ type: 'color' }]]) {
      expect(validateSongBackground(value)).toBe(
        'Invalid background: expected an object or null',
      )
    }
  })

  test('rejects a missing or unknown type', () => {
    const message =
      'Invalid background: type must be one of transparent, color, image, video'
    expect(validateSongBackground({ opacity: 1 })).toBe(message)
    expect(validateSongBackground({ type: 'gradient', opacity: 1 })).toBe(
      message,
    )
    expect(validateSongBackground({ type: 3, opacity: 1 })).toBe(message)
  })

  test('rejects an opacity that is missing, non-numeric, non-finite or out of range', () => {
    const message =
      'Invalid background: opacity must be a number between 0 and 1'
    for (const opacity of [
      undefined,
      '0.5',
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -0.1,
      1.01,
    ]) {
      expect(validateSongBackground({ type: 'color', opacity })).toBe(message)
    }
  })

  test('rejects non-string color, imageUrl and videoUrl', () => {
    expect(
      validateSongBackground({ type: 'color', color: 0xffffff, opacity: 1 }),
    ).toBe('Invalid background: color must be a string')
    expect(
      validateSongBackground({ type: 'image', imageUrl: null, opacity: 1 }),
    ).toBe('Invalid background: imageUrl must be a string')
    expect(
      validateSongBackground({ type: 'video', videoUrl: {}, opacity: 1 }),
    ).toBe('Invalid background: videoUrl must be a string')
  })
})
