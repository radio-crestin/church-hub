import { describe, expect, it } from 'bun:test'
import { removeXmlTags } from '../removeXmlTags'

describe('removeXmlTags', () => {
  it('removes opening, closing and self-closing tags', () => {
    expect(
      removeXmlTags('In <w lemma="x">the</w> beginning<note n="a"/> God'),
    ).toBe('In the beginning God')
  })

  it('leaves no tag behind in nested or broken markup', () => {
    for (const xml of [
      '<scr<script>ipt>alert(1)</script>',
      '<<script>script>x',
    ]) {
      expect(removeXmlTags(xml)).not.toMatch(/<[^>]+>/)
    }
  })

  it('keeps entity-escaped text as text', () => {
    expect(removeXmlTags('<verse>&lt;b&gt;</verse>')).toBe('&lt;b&gt;')
  })
})
