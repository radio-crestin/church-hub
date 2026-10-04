import { describe, expect, it } from 'vitest'

import { applyStylesToText } from '../applyStylesToText'
import { offsetStyleRanges } from '../offsetStyleRanges'

/** Renders the HTML the way a screen does and reads back what is styled. */
function render(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  const textOf = (selector: string) =>
    Array.from(root.querySelectorAll(selector))
      .map((element) => element.textContent)
      .join('|')
  return {
    text: root.textContent,
    underlined: textOf('u'),
    highlighted: textOf('mark'),
    bold: textOf('strong'),
  }
}

describe('applyStylesToText', () => {
  it('leaves unstyled text alone', () => {
    expect(applyStylesToText('Domnul este', [])).toBe('Domnul este')
  })

  it('keeps every style on its words when ranges overlap', () => {
    // underline "abcdef", highlight "defghi": crossed tags would drop the
    // highlight off "ghi" once the browser repairs them
    const html = applyStylesToText('abcdefghij', [
      { id: 'u', start: 0, end: 6, underline: true },
      { id: 'h', start: 3, end: 9, highlight: '#FFFF00' },
    ])

    const rendered = render(html)
    expect(rendered.text).toBe('abcdefghij')
    expect(rendered.underlined).toBe('abc|def')
    expect(rendered.highlighted).toBe('def|ghi')
  })

  it('draws the underline the same way on every screen', () => {
    const html = applyStylesToText('ab', [
      { id: 'u', start: 0, end: 2, underline: true },
    ])
    expect(html).toContain('text-decoration-thickness: 0.07em')
    expect(html).toContain('text-decoration-skip-ink: none')
  })

  it('names each style after the range that set it', () => {
    const html = applyStylesToText('abc', [
      { id: 'first', start: 0, end: 3, bold: true },
      { id: 'second', start: 1, end: 2, underline: true },
    ])
    const root = document.createElement('div')
    root.innerHTML = html
    expect(root.querySelector('u')?.dataset.highlightId).toBe('second')
    expect(root.querySelector('strong')?.dataset.highlightId).toBe('first')
  })

  it('escapes the text', () => {
    expect(
      applyStylesToText('<b>', [{ id: 'x', start: 0, end: 3, bold: true }]),
    ).toContain('&lt;b&gt;')
  })
})

describe('offsetStyleRanges', () => {
  it('moves the ranges past a prepended reference', () => {
    const reference = '(Ioan 3:16) '
    const verse = 'Fiindcă atât de mult a iubit Dumnezeu lumea'
    const ranges = [{ id: 'u', start: 38, end: 43, underline: true }]

    const html = applyStylesToText(
      `${reference}${verse}`,
      offsetStyleRanges(ranges, reference.length) ?? [],
    )

    expect(render(html).underlined).toBe('lumea')
  })

  it('returns the same array when nothing moves', () => {
    const ranges = [{ id: 'u', start: 0, end: 1 }]
    expect(offsetStyleRanges(ranges, 0)).toBe(ranges)
  })
})
