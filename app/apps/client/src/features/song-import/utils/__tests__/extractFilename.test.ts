import { describe, expect, it } from 'vitest'

import { extractFilename } from '../extractFilename'

describe('song-import/utils/extractFilename', () => {
  it('extracts filename from Unix path', () => {
    expect(extractFilename('/home/user/documents/song.pptx')).toBe('song.pptx')
  })

  it('extracts filename from Windows path', () => {
    expect(extractFilename('C:\\Users\\user\\documents\\song.pptx')).toBe(
      'song.pptx',
    )
  })

  it('extracts filename with no directory', () => {
    expect(extractFilename('song.pptx')).toBe('song.pptx')
  })

  it('returns null for null input', () => {
    expect(extractFilename(null)).toBeNull()
  })

  it('handles path with mixed separators', () => {
    expect(extractFilename('/home/user\\docs/song.pptx')).toBe('song.pptx')
  })

  it('handles path ending with separator', () => {
    // Last part is empty string, which is falsy -> returns null
    expect(extractFilename('/home/user/')).toBeNull()
  })

  it('handles deeply nested path', () => {
    expect(extractFilename('/a/b/c/d/e/file.txt')).toBe('file.txt')
  })
})
