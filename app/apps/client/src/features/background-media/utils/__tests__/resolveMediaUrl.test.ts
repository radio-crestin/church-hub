import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getApiUrl } from '~/config'
import { resolveMediaUrl } from '../resolveMediaUrl'

vi.mock('~/config', () => ({
  getApiUrl: vi.fn(),
}))

describe('resolveMediaUrl', () => {
  beforeEach(() => {
    vi.mocked(getApiUrl).mockReturnValue('http://localhost:3000')
  })

  it('prefixes a server-relative URL with the API origin', () => {
    expect(resolveMediaUrl('/api/media/backgrounds/abc.mp4')).toBe(
      'http://localhost:3000/api/media/backgrounds/abc.mp4',
    )
  })

  it('returns absolute URLs unchanged', () => {
    expect(resolveMediaUrl('https://example.com/bg.jpg')).toBe(
      'https://example.com/bg.jpg',
    )
  })

  it('returns protocol-relative URLs unchanged', () => {
    expect(resolveMediaUrl('//cdn.example.com/bg.jpg')).toBe(
      '//cdn.example.com/bg.jpg',
    )
  })

  it('keeps the relative URL when no API URL is configured', () => {
    vi.mocked(getApiUrl).mockReturnValue(null)
    expect(resolveMediaUrl('/api/media/backgrounds/abc.png')).toBe(
      '/api/media/backgrounds/abc.png',
    )
  })
})
