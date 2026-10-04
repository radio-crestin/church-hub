import { describe, expect, it } from 'vitest'

import { removeHtmlTags } from '../removeHtmlTags'

describe('removeHtmlTags', () => {
  it('removes tags and keeps the text between them', () => {
    expect(removeHtmlTags('<p>Glory <strong>to</strong> God</p>')).toBe(
      'Glory to God',
    )
  })

  it('replaces each tag with the given replacement', () => {
    expect(removeHtmlTags('<p>a</p><p>b</p>', ' ')).toBe(' a  b ')
  })

  it('leaves no tag behind in nested or broken markup', () => {
    for (const html of [
      '<scr<script>ipt>alert(1)</script>',
      '<<script>script>x',
      '<img src=x onerror=alert(1)//>',
    ]) {
      expect(removeHtmlTags(html)).not.toMatch(/<[^>]*>/)
    }
  })

  it('keeps entity-escaped text as text', () => {
    expect(removeHtmlTags('<p>&lt;b&gt; is bold</p>')).toBe('&lt;b&gt; is bold')
  })
})
