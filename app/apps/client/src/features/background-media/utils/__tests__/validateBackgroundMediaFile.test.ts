import { describe, expect, it } from 'vitest'

import { validateBackgroundMediaFile } from '../validateBackgroundMediaFile'

const MIB = 1024 * 1024

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validateBackgroundMediaFile', () => {
  it('accepts a supported image', () => {
    expect(
      validateBackgroundMediaFile(makeFile('a.png', 'image/png'), 'image'),
    ).toBeNull()
  })

  it('accepts a supported video', () => {
    expect(
      validateBackgroundMediaFile(makeFile('a.mp4', 'video/mp4'), 'video'),
    ).toBeNull()
  })

  it('falls back to the extension when the OS reports no type', () => {
    expect(validateBackgroundMediaFile(makeFile('a.WEBM', ''), 'video')).toBe(
      null,
    )
  })

  it('refuses a type outside the allow-list', () => {
    expect(
      validateBackgroundMediaFile(
        makeFile('a.mov', 'video/quicktime'),
        'video',
      ),
    ).toBe('unsupportedType')
  })

  it('refuses a video picked for an image background', () => {
    expect(
      validateBackgroundMediaFile(makeFile('a.mp4', 'video/mp4'), 'image'),
    ).toBe('unsupportedType')
  })

  it('accepts an image or a video when no kind is given', () => {
    expect(validateBackgroundMediaFile(makeFile('a.jpg', 'image/jpeg'))).toBe(
      null,
    )
    expect(validateBackgroundMediaFile(makeFile('a.mp4', 'video/mp4'))).toBe(
      null,
    )
  })

  it('refuses an unsupported file when no kind is given', () => {
    expect(validateBackgroundMediaFile(makeFile('a.txt', 'text/plain'))).toBe(
      'unsupportedType',
    )
  })

  it('applies the size limit matching the file when no kind is given', () => {
    expect(
      validateBackgroundMediaFile(makeFile('a.png', 'image/png', 50 * MIB + 1)),
    ).toBe('fileTooLarge')
    expect(
      validateBackgroundMediaFile(
        makeFile('a.webm', 'video/webm', 50 * MIB + 1),
      ),
    ).toBeNull()
  })

  it('refuses an image over 50 MiB', () => {
    expect(
      validateBackgroundMediaFile(
        makeFile('a.jpg', 'image/jpeg', 50 * MIB + 1),
        'image',
      ),
    ).toBe('fileTooLarge')
  })

  it('accepts a video up to 1 GiB', () => {
    expect(
      validateBackgroundMediaFile(
        makeFile('a.webm', 'video/webm', 1024 * MIB),
        'video',
      ),
    ).toBeNull()
  })
})
