import { describe, expect, it } from 'vitest'

import { buildOffsetMap, remapStyleRanges } from '../remapStyleRanges'

describe('buildOffsetMap', () => {
  it('is the identity when nothing changed', () => {
    const map = buildOffsetMap('abc def', 'abc def')
    expect(map).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps offsets put when a diacritic replaces a plain letter', () => {
    // "canta" -> "cântă": same length, so nothing after it moves.
    const map = buildOffsetMap('canta suflet', 'cântă suflet')
    expect(map[6]).toBe(6)
    expect(map[12]).toBe(12)
  })

  it('shifts what follows an inserted character', () => {
    const map = buildOffsetMap('sufet al meu', 'suflet al meu')
    // Everything past the inserted "l" moves along by one.
    expect(map[5]).toBe(6)
    expect(map[12]).toBe(13)
  })

  it('shifts what follows a removed character', () => {
    const map = buildOffsetMap('sufllet al meu', 'suflet al meu')
    expect(map[14]).toBe(13)
  })

  it('lands the end of the text on the end of the new text', () => {
    const before = 'o noua zi'
    const after = 'o nouă zi acum'
    expect(buildOffsetMap(before, after)[before.length]).toBe(after.length)
  })
})

describe('remapStyleRanges', () => {
  const range = (start: number, end: number) => ({
    id: 'r1',
    start,
    end,
    fontScale: 1.4,
  })

  it('leaves a run alone when the correction did not move it', () => {
    const ranges = [range(0, 5)]
    expect(remapStyleRanges(ranges, 'canta suflet', 'cântă suflet')).toEqual([
      range(0, 5),
    ])
  })

  it('carries a run past an insertion earlier in the line', () => {
    // "sufet al meu" -> "suflet al meu"; the run is on "al meu".
    const remapped = remapStyleRanges(
      [range(6, 12)],
      'sufet al meu',
      'suflet al meu',
    )
    expect(remapped[0].start).toBe(7)
    expect(remapped[0].end).toBe(13)
  })

  it('keeps a run on the words it was put on', () => {
    const before = 'e o noua zi, soarele rasare'
    const after = 'E o nouă zi, soarele răsare'
    // The run covers "soarele".
    const remapped = remapStyleRanges([range(13, 20)], before, after)
    expect(after.slice(remapped[0].start, remapped[0].end)).toBe('soarele')
  })

  it('drops a run the correction left with nothing to cover', () => {
    // The run covers exactly the stretch the correction deletes.
    expect(remapStyleRanges([range(4, 9)], 'abc XXXXX def', 'abc def')).toEqual(
      [],
    )
  })

  it('clamps a run that ran past the end of the old text', () => {
    const remapped = remapStyleRanges([range(0, 99)], 'abc', 'abcd')
    expect(remapped[0].end).toBe(4)
  })

  it('handles a passage far too long to align, without losing order', () => {
    const before = `${'a'.repeat(1200)}X${'b'.repeat(1200)}`
    const after = `${'a'.repeat(1200)}Y${'b'.repeat(1200)}`
    const remapped = remapStyleRanges([range(0, 1200)], before, after)
    expect(remapped[0].start).toBe(0)
    expect(remapped[0].end).toBeGreaterThan(0)
    expect(remapped[0].end).toBeLessThanOrEqual(after.length)
  })
})
