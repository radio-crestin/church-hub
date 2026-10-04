import { describe, expect, it } from 'vitest'

import { toSafeHttpUrl } from '../toSafeHttpUrl'

describe('toSafeHttpUrl', () => {
  it('keeps http and https URLs', () => {
    expect(toSafeHttpUrl('https://youtube.com/watch?v=abc')).toBe(
      'https://youtube.com/watch?v=abc',
    )
    expect(toSafeHttpUrl('http://192.168.1.20:3000')).toBe(
      'http://192.168.1.20:3000/',
    )
  })

  it('rejects script, data and file URLs', () => {
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(toSafeHttpUrl('JavaScript:alert(1)')).toBeNull()
    expect(toSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(toSafeHttpUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects text that is not an absolute URL', () => {
    expect(toSafeHttpUrl('')).toBeNull()
    expect(toSafeHttpUrl('/api/media/1.jpg')).toBeNull()
    expect(toSafeHttpUrl('not a url')).toBeNull()
  })
})
