import { describe, expect, it } from 'vitest'

import { getBackgroundMediaKind } from '../getBackgroundMediaKind'

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('getBackgroundMediaKind', () => {
  it('reads an image from its MIME type', () => {
    expect(getBackgroundMediaKind(makeFile('a.jpg', 'image/jpeg'))).toBe(
      'image',
    )
  })

  it('reads a video from its MIME type', () => {
    expect(getBackgroundMediaKind(makeFile('a.webm', 'video/webm'))).toBe(
      'video',
    )
  })

  it('falls back to the extension when the OS reports no type', () => {
    expect(getBackgroundMediaKind(makeFile('photo.JPG', ''))).toBe('image')
    expect(getBackgroundMediaKind(makeFile('clip.mp4', ''))).toBe('video')
  })

  it('returns null for an unsupported file', () => {
    expect(
      getBackgroundMediaKind(makeFile('a.mov', 'video/quicktime')),
    ).toBeNull()
    expect(getBackgroundMediaKind(makeFile('notes.txt', ''))).toBeNull()
  })
})
