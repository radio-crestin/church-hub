import { describe, expect, it } from 'vitest'

import { layoutColumnRows } from '../layoutColumnRows'

/** Marcaje / Programe / Versiuni, each with a header worth 6% of the column. */
const HEADERS = { bookmarks: 6, schedules: 6, versions: 6 }

/** How the column was when it was last laid out: the rows shut, then open. */
function previously(shut: string[], open: string[] = []) {
  return new Map([
    ...shut.map((id) => [id, true] as const),
    ...open.map((id) => [id, false] as const),
  ])
}

describe('layoutColumnRows', () => {
  describe('opening a row', () => {
    it('fills the column when every other row is shut', () => {
      // Marcaje opening while Programe and Versiuni are closed: it gets
      // everything the two headers do not need.
      const layout = layoutColumnRows({
        current: { bookmarks: 6, schedules: 6, versions: 88 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['schedules', 'versions']),
        previouslyShut: previously(['bookmarks', 'schedules', 'versions']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 88, schedules: 6, versions: 6 })
    })

    it('splits the column in half when one other row is open', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 6, schedules: 88, versions: 6 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['versions']),
        previouslyShut: previously(['bookmarks', 'versions'], ['schedules']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 47, schedules: 47, versions: 6 })
    })

    it('gives three open rows a third each', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 6, schedules: 47, versions: 47 },
        headerShares: HEADERS,
        shutPanelIds: new Set(),
        previouslyShut: previously(['bookmarks'], ['schedules', 'versions']),
        minOpenShare: 10,
      })
      expect(layout.bookmarks).toBeCloseTo(33.33)
      expect(layout.schedules).toBeCloseTo(33.33)
      expect(layout.versions).toBeCloseTo(33.33)
    })

    it('never gives an open row less than its floor', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 6, schedules: 47, versions: 47 },
        headerShares: HEADERS,
        shutPanelIds: new Set(),
        previouslyShut: previously(['bookmarks'], ['schedules', 'versions']),
        minOpenShare: 40,
      })
      expect(layout).toEqual({ bookmarks: 40, schedules: 40, versions: 40 })
    })
  })

  describe('closing a row', () => {
    it('gives its room to every open row, keeping their proportions', () => {
      // The operator made Marcaje twice as tall as Programe, then shut
      // Versiuni: both grow, and Marcaje is still twice as tall.
      const layout = layoutColumnRows({
        current: { bookmarks: 50, schedules: 25, versions: 25 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['versions']),
        previouslyShut: previously([], ['bookmarks', 'schedules', 'versions']),
        minOpenShare: 10,
      })
      expect(layout.versions).toBe(6)
      expect(layout.bookmarks).toBeCloseTo(62.67)
      expect(layout.schedules).toBeCloseTo(31.33)
    })

    it('reaches past a shut neighbour to the row still open', () => {
      // Programe is already shut and sits between the two: Marcaje's room must
      // not end up under Programe's header.
      const layout = layoutColumnRows({
        current: { bookmarks: 33, schedules: 6, versions: 61 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['bookmarks', 'schedules']),
        previouslyShut: previously(['schedules'], ['bookmarks', 'versions']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 6, schedules: 6, versions: 88 })
    })

    it('leaves an open row dragged down to its header where it is', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 30, schedules: 6, versions: 64 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['bookmarks']),
        previouslyShut: previously([], ['bookmarks', 'schedules', 'versions']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 6, schedules: 6, versions: 88 })
    })

    it('keeps a row hidden by dragging hidden', () => {
      // Panels without a header (the verses, the stage) are hidden by dragging
      // them to nothing, and closing a neighbour must not bring them back.
      const layout = layoutColumnRows({
        current: { slides: 0, bookmarks: 40, versions: 60 },
        headerShares: { bookmarks: 6, versions: 6 },
        shutPanelIds: new Set(['bookmarks']),
        previouslyShut: previously([], ['bookmarks', 'versions']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ slides: 0, bookmarks: 6, versions: 94 })
    })

    it('lets the last row take the room when every row is shut', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 6, schedules: 6, versions: 88 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['bookmarks', 'schedules', 'versions']),
        previouslyShut: previously(['bookmarks', 'schedules'], ['versions']),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 6, schedules: 6, versions: 88 })
    })
  })

  describe('rows the column has not laid out before', () => {
    it('pins a shut row that stored sizes left holding room', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 32, schedules: 62, versions: 6 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['schedules', 'versions']),
        previouslyShut: previously([]),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 88, schedules: 6, versions: 6 })
    })

    it('opens a row that was shut when the sizes were saved', () => {
      // Versiuni was opened in the other editing layout since.
      const layout = layoutColumnRows({
        current: { bookmarks: 88, schedules: 6, versions: 6 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['schedules']),
        previouslyShut: previously([]),
        minOpenShare: 10,
      })
      expect(layout).toEqual({ bookmarks: 47, schedules: 6, versions: 47 })
    })

    it('opens a row that joins the column open but no taller than its header', () => {
      // Programe appearing once the permission to see it has loaded.
      const layout = layoutColumnRows({
        current: { bookmarks: 47, schedules: 6, versions: 47 },
        headerShares: HEADERS,
        shutPanelIds: new Set(),
        previouslyShut: previously([], ['bookmarks', 'versions']),
        minOpenShare: 10,
      })
      expect(layout.bookmarks).toBeCloseTo(33.33)
      expect(layout.schedules).toBeCloseTo(33.33)
      expect(layout.versions).toBeCloseTo(33.33)
    })

    it('leaves sizes that already agree with the open rows as they are', () => {
      const layout = layoutColumnRows({
        current: { bookmarks: 60, schedules: 6, versions: 34 },
        headerShares: HEADERS,
        shutPanelIds: new Set(['schedules']),
        previouslyShut: previously([]),
        minOpenShare: 10,
      })
      expect(layout.bookmarks).toBeCloseTo(60)
      expect(layout.schedules).toBe(6)
      expect(layout.versions).toBeCloseTo(34)
    })
  })

  it('leaves a single-row column alone', () => {
    expect(
      layoutColumnRows({
        current: { only: 100 },
        headerShares: {},
        shutPanelIds: new Set(),
        previouslyShut: previously([]),
        minOpenShare: 10,
      }),
    ).toEqual({ only: 100 })
  })
})
