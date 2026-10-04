import { describe, expect, it } from 'vitest'

import { decodeHtmlEntities } from '../decodeHtmlEntities'

describe('decodeHtmlEntities', () => {
  it('decodes the named entities slide HTML uses', () => {
    expect(
      decodeHtmlEntities('&quot;a&quot; &amp; &lt;b&gt; &apos;c&apos;'),
    ).toBe(`"a" & <b> 'c'`)
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b')
  })

  it('decodes decimal and hex character references', () => {
    expect(decodeHtmlEntities('&#039;&#x21;&#X21;')).toBe("'!&#X21;")
    expect(decodeHtmlEntities('&#x219B;')).toBe('↛')
  })

  it('decodes once, so an escaped entity stays literal text', () => {
    expect(decodeHtmlEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;')
    expect(decodeHtmlEntities('&amp;quot;')).toBe('&quot;')
    expect(decodeHtmlEntities('&amp;#60;')).toBe('&#60;')
  })

  it('leaves unknown entities and plain text unchanged', () => {
    expect(decodeHtmlEntities('&copy; Tom & Jerry')).toBe('&copy; Tom & Jerry')
  })
})
