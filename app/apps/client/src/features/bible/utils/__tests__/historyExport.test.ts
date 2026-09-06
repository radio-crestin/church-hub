import { describe, expect, it } from 'vitest'

import type { BibleHistoryItem } from '../../types'
import { formatHistoryAsSchedule } from '../formatHistoryAsSchedule'
import { getLastSessionItems, SESSION_GAP_MS } from '../getLastSessionItems'

const HOUR = 60 * 60 * 1000
const BASE = new Date('2026-08-23T18:00:00Z').getTime()

/** Builds a history item that was shown `hoursAgo` hours before BASE. */
const makeItem = (
  id: number,
  hoursAgo: number,
  overrides: Partial<BibleHistoryItem> = {},
): BibleHistoryItem => ({
  id,
  verseId: id,
  reference: `Ioan 3:${id} - VDCC`,
  text: `Text ${id}`,
  translationAbbreviation: 'VDCC',
  bookName: 'Ioan',
  translationId: 1,
  bookId: 43,
  chapter: 3,
  verse: id,
  createdAt: BASE - hoursAgo * HOUR,
  ...overrides,
})

describe('getLastSessionItems', () => {
  it('returns nothing for an empty history', () => {
    expect(getLastSessionItems([])).toEqual([])
  })

  it('keeps verses shown close together, newest first', () => {
    const items = [makeItem(1, 2), makeItem(2, 1), makeItem(3, 0)]

    expect(getLastSessionItems(items).map((i) => i.id)).toEqual([3, 2, 1])
  })

  it('stops at the first long gap', () => {
    // Two verses from this evening, two from a service two days earlier.
    const items = [
      makeItem(1, 50),
      makeItem(2, 49),
      makeItem(3, 1),
      makeItem(4, 0),
    ]

    expect(getLastSessionItems(items).map((i) => i.id)).toEqual([4, 3])
  })

  it('keeps a session that ran past midnight together', () => {
    // 23:30 and 00:30 sit an hour apart but land on different calendar days.
    const items = [makeItem(1, 1), makeItem(2, 0)]

    expect(getLastSessionItems(items)).toHaveLength(2)
  })

  it('treats a gap exactly at the threshold as the same session', () => {
    const items = [
      makeItem(1, 0, { createdAt: BASE - SESSION_GAP_MS }),
      makeItem(2, 0),
    ]

    expect(getLastSessionItems(items)).toHaveLength(2)
  })

  it('leaves the input array untouched', () => {
    const items = [makeItem(1, 0), makeItem(2, 1)]
    getLastSessionItems(items)

    expect(items.map((i) => i.id)).toEqual([1, 2])
  })

  it('returns only the newest verse when everything else is old', () => {
    const items = [makeItem(1, 100), makeItem(2, 99), makeItem(3, 0)]

    expect(getLastSessionItems(items).map((i) => i.id)).toEqual([3])
  })
})

describe('formatHistoryAsSchedule', () => {
  it('writes newest first, strips the translation suffix and keeps the text as a comment', () => {
    const items = [makeItem(16, 1), makeItem(17, 0)]

    const output = formatHistoryAsSchedule(items, {
      title: 'Bible History',
      help: 'Use [V] for Bible verses',
    })

    expect(output.split('\n')).toEqual([
      '# Bible History',
      '# Use [V] for Bible verses',
      '',
      'Ioan 3:17 [V]',
      '# Text 17',
      '',
      'Ioan 3:16 [V]',
      '# Text 16',
      '',
    ])
  })

  it('still emits the header when there is nothing to export', () => {
    const output = formatHistoryAsSchedule([], { title: 'T', help: 'H' })

    expect(output).toBe('# T\n# H\n')
  })
})
