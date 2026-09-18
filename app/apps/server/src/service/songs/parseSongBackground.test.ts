import { parseSongBackground } from './parseSongBackground'
import { serializeSongBackground } from './serializeSongBackground'
import { describe, expect, test } from 'bun:test'

describe('parseSongBackground / serializeSongBackground', () => {
  test('no override stores as NULL and reads back as null', () => {
    expect(serializeSongBackground(null)).toBeNull()
    expect(serializeSongBackground(undefined)).toBeNull()
    expect(parseSongBackground(null)).toBeNull()
    expect(parseSongBackground(undefined)).toBeNull()
    expect(parseSongBackground('')).toBeNull()
  })

  test('round-trips a background config', () => {
    const background = {
      type: 'image' as const,
      imageUrl: '/api/media/backgrounds/a.png',
      opacity: 0.8,
    }
    expect(parseSongBackground(serializeSongBackground(background))).toEqual(
      background,
    )
  })

  test('serializes only the known config keys', () => {
    const withExtras = {
      type: 'color' as const,
      color: '#000000',
      opacity: 1,
      injected: '<script>',
    }
    expect(JSON.parse(serializeSongBackground(withExtras) ?? '')).toEqual({
      type: 'color',
      color: '#000000',
      opacity: 1,
    })
  })

  test('malformed or invalid stored JSON reads as no override', () => {
    expect(parseSongBackground('{not json')).toBeNull()
    expect(parseSongBackground('null')).toBeNull()
    expect(parseSongBackground('"color"')).toBeNull()
    expect(parseSongBackground('{"type":"gradient","opacity":1}')).toBeNull()
    expect(parseSongBackground('{"type":"color","opacity":7}')).toBeNull()
  })
})
