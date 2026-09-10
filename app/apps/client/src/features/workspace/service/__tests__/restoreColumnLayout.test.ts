import { describe, expect, it } from 'vitest'

import { restoreColumnLayout } from '../restoreColumnLayout'

describe('restoreColumnLayout', () => {
  it('fills the column when every other row is shut', () => {
    // Marcaje opening while Programe and Versiuni are closed: it gets
    // everything the two headers do not need.
    const layout = restoreColumnLayout({
      current: { bookmarks: 6, schedules: 6, versions: 6 },
      panelId: 'bookmarks',
      collapsedShare: 6,
      collapsedPanelIds: new Set(['schedules', 'versions']),
      minOpenShare: 10,
    })
    expect(layout.bookmarks).toBe(88)
    expect(layout.schedules).toBe(6)
    expect(layout.versions).toBe(6)
  })

  it('splits the column in half when one other row is open', () => {
    const layout = restoreColumnLayout({
      current: { bookmarks: 6, schedules: 88, versions: 6 },
      panelId: 'bookmarks',
      collapsedShare: 6,
      collapsedPanelIds: new Set(['versions']),
      minOpenShare: 10,
    })
    expect(layout.bookmarks).toBe(47)
    expect(layout.schedules).toBe(47)
    expect(layout.versions).toBe(6)
  })

  it('gives three open rows a third each', () => {
    const layout = restoreColumnLayout({
      current: { a: 6, b: 47, c: 47 },
      panelId: 'a',
      collapsedShare: 6,
      collapsedPanelIds: new Set(),
      minOpenShare: 10,
    })
    expect(layout.a).toBeCloseTo(33.33)
    expect(layout.b).toBeCloseTo(33.33)
    expect(layout.c).toBeCloseTo(33.33)
  })

  it('treats the row being opened as open, whatever it was a moment ago', () => {
    // The chevron has flipped but the group has not caught up yet.
    const layout = restoreColumnLayout({
      current: { bookmarks: 6, schedules: 94 },
      panelId: 'bookmarks',
      collapsedShare: 6,
      collapsedPanelIds: new Set(['bookmarks']),
      minOpenShare: 10,
    })
    expect(layout.bookmarks).toBe(50)
    expect(layout.schedules).toBe(50)
  })

  it('never gives an open row less than its floor', () => {
    const layout = restoreColumnLayout({
      current: { a: 30, b: 30, c: 40 },
      panelId: 'a',
      collapsedShare: 6,
      collapsedPanelIds: new Set(),
      minOpenShare: 40,
    })
    expect(layout.a).toBe(40)
    expect(layout.b).toBe(40)
    expect(layout.c).toBe(40)
  })

  it('leaves a single-row column alone', () => {
    expect(
      restoreColumnLayout({
        current: { only: 100 },
        panelId: 'only',
        collapsedShare: 6,
        collapsedPanelIds: new Set(),
        minOpenShare: 10,
      }),
    ).toEqual({ only: 100 })
  })
})
