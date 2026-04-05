import { parseSlideHighlights } from './highlights'
import { describe, expect, it } from 'bun:test'

describe('parseSlideHighlights', () => {
  it('returns empty array for null input', () => {
    expect(parseSlideHighlights(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseSlideHighlights('')).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseSlideHighlights('not json')).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    expect(parseSlideHighlights('{"id": "1"}')).toEqual([])
  })

  it('returns empty array for JSON number', () => {
    expect(parseSlideHighlights('42')).toEqual([])
  })

  it('returns empty array for JSON string', () => {
    expect(parseSlideHighlights('"hello"')).toEqual([])
  })

  it('parses valid highlight array', () => {
    const highlights = [
      {
        id: 'h1',
        start: 0,
        end: 10,
        highlight: '#FFFF00',
        bold: false,
        underline: false,
      },
      {
        id: 'h2',
        start: 15,
        end: 25,
        highlight: '#FF0000',
        bold: true,
        underline: false,
      },
    ]
    const json = JSON.stringify(highlights)
    const result = parseSlideHighlights(json)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('h1')
    expect(result[0].start).toBe(0)
    expect(result[0].end).toBe(10)
    expect(result[0].highlight).toBe('#FFFF00')
    expect(result[1].id).toBe('h2')
    expect(result[1].bold).toBe(true)
  })

  it('returns parsed array even with empty array JSON', () => {
    expect(parseSlideHighlights('[]')).toEqual([])
  })

  it('handles array with single highlight', () => {
    const highlights = [{ id: 'solo', start: 5, end: 10 }]
    const result = parseSlideHighlights(JSON.stringify(highlights))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('solo')
  })
})
