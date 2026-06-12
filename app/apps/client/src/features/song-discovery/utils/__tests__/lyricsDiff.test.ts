import { describe, expect, it } from 'vitest'

import { diffLines, hasChanges, slidesToLines } from '../lyricsDiff'

describe('slidesToLines', () => {
  it('strips HTML to trimmed lyric lines, blank-separating slides', () => {
    const lines = slidesToLines([
      { content: '<p>Line one</p><p>Line two</p>' },
      { content: '<p>Verse two</p>' },
    ])
    expect(lines).toEqual(['Line one', 'Line two', '', 'Verse two'])
  })

  it('handles <br> and collapses whitespace', () => {
    expect(slidesToLines([{ content: '<p>a<br>b</p><p>  c  d </p>' }])).toEqual(
      ['a', 'b', 'c d'],
    )
  })
})

describe('diffLines', () => {
  it('marks added/removed/context lines (library = base, candidate = head)', () => {
    const library = ['Lauda pe Domnul', 'Refren vechi', 'Final']
    const candidate = ['Lauda pe Domnul', 'Refren nou', 'Final']
    const diff = diffLines(library, candidate)
    expect(diff).toEqual([
      { type: 'context', text: 'Lauda pe Domnul' },
      { type: 'removed', text: 'Refren vechi' },
      { type: 'added', text: 'Refren nou' },
      { type: 'context', text: 'Final' },
    ])
  })

  it('reports no changes for identical lyrics', () => {
    const same = ['a', 'b', 'c']
    expect(hasChanges(diffLines(same, same))).toBe(false)
  })

  it('detects pure additions', () => {
    const diff = diffLines(['a'], ['a', 'b'])
    expect(diff).toEqual([
      { type: 'context', text: 'a' },
      { type: 'added', text: 'b' },
    ])
    expect(hasChanges(diff)).toBe(true)
  })
})
