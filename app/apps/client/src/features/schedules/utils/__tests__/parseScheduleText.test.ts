import { describe, expect, it } from 'vitest'

import { parseScheduleText } from '../parseScheduleText'

describe('schedules/utils/parseScheduleText', () => {
  it('parses a song line', () => {
    const result = parseScheduleText('Amazing Grace [S]')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual({
      type: 'song',
      content: 'Amazing Grace',
      lineNumber: 1,
    })
    expect(result.errors).toHaveLength(0)
  })

  it('parses a song with ID', () => {
    const result = parseScheduleText('Amazing Grace #42 [S]')
    expect(result.items[0]).toEqual({
      type: 'song',
      content: 'Amazing Grace',
      lineNumber: 1,
      songId: 42,
    })
  })

  it('parses Romanian song suffix [C]', () => {
    const result = parseScheduleText('Cantec frumos [C]')
    expect(result.items[0].type).toBe('song')
    expect(result.items[0].content).toBe('Cantec frumos')
  })

  it('parses announcement [A]', () => {
    const result = parseScheduleText('Welcome message [A]')
    expect(result.items[0].type).toBe('announcement')
    expect(result.items[0].content).toBe('Welcome message')
  })

  it('parses bible passage [V]', () => {
    const result = parseScheduleText('Ioan 3:16 [V]')
    expect(result.items[0].type).toBe('bible_passage')
    expect(result.items[0].content).toBe('Ioan 3:16')
  })

  it('parses versete tineri [VT]', () => {
    const result = parseScheduleText('Ion Popescu - Ioan 3:16 [VT]')
    expect(result.items[0].type).toBe('versete_tineri')
    expect(result.items[0].content).toBe('Ion Popescu - Ioan 3:16')
  })

  it('parses scene [SC]', () => {
    const result = parseScheduleText('Camera 1 [SC]')
    expect(result.items[0].type).toBe('scene')
    expect(result.items[0].content).toBe('Camera 1')
  })

  it('is case-insensitive for suffixes', () => {
    const result = parseScheduleText('Test [s]')
    expect(result.items[0].type).toBe('song')
  })

  it('skips empty lines', () => {
    const result = parseScheduleText('\n\nSong [S]\n\n')
    expect(result.items).toHaveLength(1)
  })

  it('skips comment lines', () => {
    const result = parseScheduleText('# This is a comment\nSong [S]')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].content).toBe('Song')
  })

  it('reports errors for invalid format lines', () => {
    const result = parseScheduleText('Invalid line without suffix')
    expect(result.items).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toContain('Invalid format')
  })

  it('reports error for whitespace-only content before suffix', () => {
    // ' [S]' - the regex doesn't match because the content part is empty/whitespace
    const result = parseScheduleText(' [S]')
    expect(result.errors).toHaveLength(1)
    // The regex doesn't match at all, so it reports 'Invalid format'
    expect(result.errors[0].message).toContain('Invalid format')
  })

  it('stops parsing at --- separator', () => {
    const result = parseScheduleText('Song 1 [S]\n---\nSong 2 [S]')
    expect(result.items).toHaveLength(1)
  })

  it('stops parsing at schedule content separator', () => {
    const result = parseScheduleText(
      'Song 1 [S]\n--- Schedule Content ---\nSong 2 [S]',
    )
    expect(result.items).toHaveLength(1)
  })

  it('parses multiple items', () => {
    const text = `Amazing Grace #1 [S]
Ioan 3:16 [V]
Welcome [A]
Camera [SC]`
    const result = parseScheduleText(text)
    expect(result.items).toHaveLength(4)
    expect(result.items[0].type).toBe('song')
    expect(result.items[1].type).toBe('bible_passage')
    expect(result.items[2].type).toBe('announcement')
    expect(result.items[3].type).toBe('scene')
  })

  it('tracks correct line numbers', () => {
    const text = '# comment\n\nSong [S]\n\nBible [V]'
    const result = parseScheduleText(text)
    expect(result.items[0].lineNumber).toBe(3)
    expect(result.items[1].lineNumber).toBe(5)
  })

  it('handles mixed valid and invalid lines', () => {
    const text = 'Good [S]\nBad line\nAlso good [V]'
    const result = parseScheduleText(text)
    expect(result.items).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(2)
  })

  it('does not extract songId from non-song types', () => {
    const result = parseScheduleText('Announce #42 [A]')
    expect(result.items[0].songId).toBeUndefined()
    expect(result.items[0].content).toBe('Announce #42')
  })
})
