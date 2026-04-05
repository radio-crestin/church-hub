import { describe, expect, it } from 'vitest'

import { isOpenSongXml, parseOpenSongXml } from '../parseOpenSong'

describe('song-import/utils/parseOpenSong', () => {
  describe('isOpenSongXml', () => {
    it('returns true for valid OpenSong XML', () => {
      expect(isOpenSongXml('<song>\n<lyrics>\ntext\n</lyrics>\n</song>')).toBe(
        true,
      )
    })

    it('returns true with leading whitespace', () => {
      expect(isOpenSongXml('  <song>\n<lyrics>text</lyrics>\n</song>')).toBe(
        true,
      )
    })

    it('returns false for non-OpenSong XML', () => {
      expect(isOpenSongXml('<html><body>Hello</body></html>')).toBe(false)
    })

    it('returns false for missing <lyrics> tag', () => {
      expect(isOpenSongXml('<song><title>Test</title></song>')).toBe(false)
    })

    it('returns false for non-XML content', () => {
      expect(isOpenSongXml('Just plain text')).toBe(false)
    })
  })

  describe('parseOpenSongXml', () => {
    const basicSong = `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>Amazing Grace</title>
  <author>John Newton</author>
  <lyrics>
[V1]
 Amazing grace how sweet the sound
 That saved a wretch like me
[V2]
 Twas grace that taught my heart to fear
 And grace my fears relieved
[C]
 My chains are gone I've been set free
  </lyrics>
</song>`

    it('parses title from XML', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.title).toBe('Amazing Grace')
    })

    it('parses metadata', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.metadata?.author).toBe('John Newton')
    })

    it('parses verses', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.verses).toHaveLength(3)
      expect(result.verses[0].label).toBe('V1')
      expect(result.verses[1].label).toBe('V2')
      expect(result.verses[2].label).toBe('C')
    })

    it('parses verse lines correctly', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.verses[0].lines).toHaveLength(2)
      expect(result.verses[0].lines[0]).toBe(
        'Amazing grace how sweet the sound',
      )
    })

    it('creates slides from verses in natural order', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.slides).toHaveLength(3)
      expect(result.slides[0].label).toBe('V1')
      expect(result.slides[1].label).toBe('V2')
      expect(result.slides[2].label).toBe('C')
    })

    it('uses presentation order when specified', () => {
      const songWithOrder = `<song>
  <title>Test</title>
  <presentation>C V1 C V2 C</presentation>
  <lyrics>
[V1]
 Verse one
[V2]
 Verse two
[C]
 Chorus
  </lyrics>
</song>`
      const result = parseOpenSongXml(songWithOrder)
      expect(result.slides).toHaveLength(5)
      expect(result.slides[0].label).toBe('C')
      expect(result.slides[1].label).toBe('V1')
      expect(result.slides[2].label).toBe('C')
    })

    it('uses filename as fallback title', () => {
      const noTitle = '<song><lyrics>[V1]\n Line 1\n</lyrics></song>'
      const result = parseOpenSongXml(noTitle, 'my-song.xml')
      expect(result.title).toBe('my-song')
    })

    it('returns "Untitled Song" when no title and no filename', () => {
      const noTitle = '<song><lyrics>[V1]\n Line 1\n</lyrics></song>'
      const result = parseOpenSongXml(noTitle)
      expect(result.title).toBe('Untitled Song')
    })

    it('throws on invalid XML', () => {
      expect(() => parseOpenSongXml('not xml at all <><>')).toThrow()
    })

    it('throws on missing <song> element', () => {
      expect(() =>
        parseOpenSongXml('<?xml version="1.0"?><root></root>'),
      ).toThrow('missing <song> element')
    })

    it('generates HTML content for slides', () => {
      const result = parseOpenSongXml(basicSong)
      expect(result.slides[0].htmlContent).toContain('<p>')
    })

    it('escapes HTML in lyrics', () => {
      const songWithHtml = `<song>
  <title>Test</title>
  <lyrics>
[V1]
 Line with &lt;html&gt; chars
  </lyrics>
</song>`
      const result = parseOpenSongXml(songWithHtml)
      expect(result.slides[0].htmlContent).toContain('&lt;html&gt;')
    })

    it('parses church_hub_id metadata', () => {
      const songWithId = `<song>
  <title>Test</title>
  <church_hub_id>42</church_hub_id>
  <lyrics>
[V1]
 Line
  </lyrics>
</song>`
      const result = parseOpenSongXml(songWithId)
      expect(result.metadata?.churchHubId).toBe(42)
    })

    it('handles empty lyrics', () => {
      const emptySong = '<song><title>Empty</title><lyrics></lyrics></song>'
      const result = parseOpenSongXml(emptySong)
      expect(result.slides).toHaveLength(0)
      expect(result.verses).toHaveLength(0)
    })
  })
})
