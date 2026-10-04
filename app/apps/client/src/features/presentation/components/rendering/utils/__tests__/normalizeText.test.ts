import { describe, expect, it } from 'vitest'

import { normalizeText } from '../normalizeText'

/**
 * Real slide content as stored in a church's database (2026-10-04 copy):
 * 7,097 of 146,728 slides carry entities — `&#039;` (6,412), `&quot;` (4,009),
 * `&gt;` (34), `&lt;` (32) — and none is double-encoded (`&amp;lt;`). Every
 * importer and the editor store text escaped exactly once, so decoding once
 * (since #89) shows the same characters the old double decode did.
 */
describe('normalizeText on stored slide HTML', () => {
  it('shows apostrophes stored as &#039;', () => {
    expect(
      normalizeText(
        '<p>A fost chemat în Cana Galileea</p><p>Acolo apa&#039;n vin se prefăcuse</p>',
        true,
      ),
    ).toBe("A fost chemat în Cana Galileea\nAcolo apa'n vin se prefăcuse")
  })

  it('shows quotes stored as &quot;', () => {
    expect(
      normalizeText('<p>&quot;Iată Mielul lui Dumnezeu&quot;</p>', true),
    ).toBe('"Iată Mielul lui Dumnezeu"')
  })

  it('shows < and > stored as &lt; / &gt;', () => {
    expect(
      normalizeText('<p>&lt;number&gt;</p><p>Ziua nu-i departe,</p>', true),
    ).toBe('<number>\nZiua nu-i departe,')
  })

  it('shows & typed in the editor (stored as &amp;)', () => {
    expect(normalizeText('<p>Tom &amp; Jerry</p>', true)).toBe('Tom & Jerry')
  })

  it('keeps text typed as an entity literal (stored as &amp;lt;)', () => {
    expect(normalizeText('<p>Type &amp;lt;b&amp;gt; for bold</p>', true)).toBe(
      'Type &lt;b&gt; for bold',
    )
  })
})
