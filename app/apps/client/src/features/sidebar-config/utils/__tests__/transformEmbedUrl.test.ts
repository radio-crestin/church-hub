import { describe, expect, it } from 'vitest'

import {
  isYouTubeUrl,
  transformToEmbedUrl,
  transformYouTubeToEmbed,
} from '../transformEmbedUrl'

describe('sidebar-config/utils/transformEmbedUrl', () => {
  describe('isYouTubeUrl', () => {
    it('returns true for youtube.com URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true)
    })

    it('returns true for youtu.be URLs', () => {
      expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true)
    })

    it('returns true for youtube-nocookie.com URLs', () => {
      expect(
        isYouTubeUrl('https://www.youtube-nocookie.com/embed/abc123'),
      ).toBe(true)
    })

    it('returns false for non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://www.google.com')).toBe(false)
      expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false)
    })
  })

  describe('transformYouTubeToEmbed', () => {
    it('transforms youtube.com/watch?v= URL', () => {
      const result = transformYouTubeToEmbed(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      )
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('transforms youtu.be URL', () => {
      const result = transformYouTubeToEmbed('https://youtu.be/dQw4w9WgXcQ')
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('transforms youtube.com/embed/ URL', () => {
      const result = transformYouTubeToEmbed(
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
      )
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('transforms youtube.com/shorts/ URL', () => {
      const result = transformYouTubeToEmbed(
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      )
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('transforms youtube.com/v/ URL', () => {
      const result = transformYouTubeToEmbed(
        'https://www.youtube.com/v/dQw4w9WgXcQ',
      )
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('handles watch URL with extra query params', () => {
      const result = transformYouTubeToEmbed(
        'https://www.youtube.com/watch?list=PLabc&v=dQw4w9WgXcQ&t=42',
      )
      expect(result).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
      )
    })

    it('returns null for invalid YouTube URL', () => {
      expect(transformYouTubeToEmbed('https://www.youtube.com/')).toBeNull()
      expect(
        transformYouTubeToEmbed('https://www.youtube.com/channel/abc'),
      ).toBeNull()
    })

    it('returns null for non-YouTube URL', () => {
      expect(transformYouTubeToEmbed('https://www.google.com')).toBeNull()
    })
  })

  describe('transformToEmbedUrl', () => {
    it('transforms YouTube URLs', () => {
      const result = transformToEmbedUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      )
      expect(result).toContain('youtube-nocookie.com/embed')
    })

    it('returns non-YouTube URLs unchanged', () => {
      const url = 'https://www.google.com'
      expect(transformToEmbedUrl(url)).toBe(url)
    })

    it('returns original URL if YouTube video ID cannot be extracted', () => {
      const url = 'https://www.youtube.com/channel/UCabc'
      expect(transformToEmbedUrl(url)).toBe(url)
    })
  })
})
