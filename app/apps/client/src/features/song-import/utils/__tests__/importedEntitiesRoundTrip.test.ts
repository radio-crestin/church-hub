import { describe, expect, it } from 'vitest'

import { normalizeText } from '~/features/presentation/components/rendering/utils/normalizeText'
import { plainTextToSlideHtml } from '~/features/songs/utils/plainTextToSlideHtml'
import { parseOpenSongXml } from '../parseOpenSong'

/**
 * Imports store slide text escaped exactly once (DOM-decoded source → one
 * escape), which is what the single-pass decoder expects: the projection
 * shows the characters of the source, never a code like `&amp;`.
 */
describe('imported slide text shows the source characters', () => {
  it('OpenSong: & < > " in the XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song><title>T</title><lyrics>
[V1]
 Tom &amp; Jerry &lt;3 &quot;Amin&quot;
</lyrics></song>`
    const [slide] = parseOpenSongXml(xml).slides
    expect(slide.htmlContent).toBe(
      '<p>Tom &amp; Jerry &lt;3 &quot;Amin&quot;</p>',
    )
    expect(normalizeText(slide.htmlContent, true)).toBe('Tom & Jerry <3 "Amin"')
  })

  it('OpenSong: an entity written out as text stays text', () => {
    const xml = `<song><lyrics>
[V1]
 Type &amp;lt;b&amp;gt; for bold
</lyrics></song>`
    const [slide] = parseOpenSongXml(xml).slides
    expect(normalizeText(slide.htmlContent, true)).toBe(
      'Type &lt;b&gt; for bold',
    )
  })

  it('pasted plain text: & and < round-trip', () => {
    const html = plainTextToSlideHtml("Apa'n vin & <număr>")
    expect(normalizeText(html, true)).toBe("Apa'n vin & <număr>")
  })
})
