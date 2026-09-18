import { parseRangeHeader } from './parseRangeHeader'
import { describe, expect, test } from 'bun:test'

const SIZE = 1000

describe('parseRangeHeader', () => {
  test('no header serves the whole file', () => {
    expect(parseRangeHeader(null, SIZE)).toEqual({ type: 'none' })
    expect(parseRangeHeader('', SIZE)).toEqual({ type: 'none' })
  })

  test('closed range bytes=a-b', () => {
    expect(parseRangeHeader('bytes=0-99', SIZE)).toEqual({
      type: 'range',
      start: 0,
      end: 99,
    })
    expect(parseRangeHeader('bytes=500-500', SIZE)).toEqual({
      type: 'range',
      start: 500,
      end: 500,
    })
  })

  test('end past the file is clamped to the last byte', () => {
    expect(parseRangeHeader('bytes=900-5000', SIZE)).toEqual({
      type: 'range',
      start: 900,
      end: 999,
    })
  })

  test('open range bytes=a- runs to the end', () => {
    expect(parseRangeHeader('bytes=0-', SIZE)).toEqual({
      type: 'range',
      start: 0,
      end: 999,
    })
    expect(parseRangeHeader('bytes=999-', SIZE)).toEqual({
      type: 'range',
      start: 999,
      end: 999,
    })
  })

  test('suffix range bytes=-n is the last n bytes', () => {
    expect(parseRangeHeader('bytes=-100', SIZE)).toEqual({
      type: 'range',
      start: 900,
      end: 999,
    })
  })

  test('suffix longer than the file is the whole file', () => {
    expect(parseRangeHeader('bytes=-5000', SIZE)).toEqual({
      type: 'range',
      start: 0,
      end: 999,
    })
  })

  test('start at or past the end is unsatisfiable', () => {
    expect(parseRangeHeader('bytes=1000-', SIZE)).toEqual({
      type: 'unsatisfiable',
    })
    expect(parseRangeHeader('bytes=1000-2000', SIZE)).toEqual({
      type: 'unsatisfiable',
    })
    expect(parseRangeHeader('bytes=99999999999999999999-', SIZE)).toEqual({
      type: 'unsatisfiable',
    })
  })

  test('zero-length suffix or empty file is unsatisfiable', () => {
    expect(parseRangeHeader('bytes=-0', SIZE)).toEqual({
      type: 'unsatisfiable',
    })
    expect(parseRangeHeader('bytes=-10', 0)).toEqual({ type: 'unsatisfiable' })
    expect(parseRangeHeader('bytes=0-', 0)).toEqual({ type: 'unsatisfiable' })
  })

  test('unit and surrounding whitespace are tolerated', () => {
    expect(parseRangeHeader('  BYTES=10-19 ', SIZE)).toEqual({
      type: 'range',
      start: 10,
      end: 19,
    })
  })

  test('malformed, inverted and multi-range headers are ignored', () => {
    for (const header of [
      'bytes=-',
      'bytes=abc',
      'bytes=5',
      'items=0-10',
      'bytes=0-10,20-30',
      'bytes=-1-5',
      'bytes=50-10',
      'bytes= 0-10',
    ]) {
      expect(parseRangeHeader(header, SIZE)).toEqual({ type: 'none' })
    }
  })
})
