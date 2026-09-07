import { describe, expect, it } from 'vitest'

import { restoreColumnLayout } from '../restoreColumnLayout'

describe('restoreColumnLayout', () => {
  it('gives the row its remembered height when the column can afford it', () => {
    const layout = restoreColumnLayout({
      current: { bookmarks: 10, schedules: 45, versions: 45 },
      panelId: 'bookmarks',
      remembered: 50,
      collapsedPanelIds: new Set(),
      minOpenShare: 15,
    })
    expect(layout.bookmarks).toBe(50)
    expect(layout.schedules + layout.versions).toBeCloseTo(50)
  })

  it('never lets a remembered height push a neighbour off the column', () => {
    const layout = restoreColumnLayout({
      current: { bookmarks: 10, schedules: 45, versions: 45 },
      panelId: 'bookmarks',
      // The height that used to collapse both neighbours to nothing.
      remembered: 95,
      collapsedPanelIds: new Set(),
      minOpenShare: 15,
    })
    expect(layout.bookmarks).toBe(70)
    expect(layout.schedules).toBeGreaterThanOrEqual(15)
    expect(layout.versions).toBeGreaterThanOrEqual(15)
  })

  it('leaves collapsed rows pinned to the header share they already have', () => {
    const layout = restoreColumnLayout({
      current: { bookmarks: 10, schedules: 6, versions: 84 },
      panelId: 'bookmarks',
      remembered: 90,
      collapsedPanelIds: new Set(['schedules']),
      minOpenShare: 15,
    })
    expect(layout.schedules).toBe(6)
    expect(layout.bookmarks).toBe(79)
    expect(layout.versions).toBe(15)
  })

  it('keeps the proportions the open rows already had', () => {
    const layout = restoreColumnLayout({
      current: { a: 10, b: 60, c: 30 },
      panelId: 'a',
      remembered: 40,
      collapsedPanelIds: new Set(),
      minOpenShare: 10,
    })
    expect(layout.a).toBe(40)
    // b was twice c, and stays twice c inside the 60 that is left.
    expect(layout.b).toBeCloseTo(40)
    expect(layout.c).toBeCloseTo(20)
  })

  it('shares the room evenly when every other row has been dragged shut', () => {
    const layout = restoreColumnLayout({
      current: { a: 100, b: 0, c: 0 },
      panelId: 'a',
      remembered: 60,
      collapsedPanelIds: new Set(),
      minOpenShare: 10,
    })
    expect(layout.a).toBe(60)
    expect(layout.b).toBeCloseTo(20)
    expect(layout.c).toBeCloseTo(20)
  })

  it('still leaves the expanded row a floor when the column is crowded', () => {
    const layout = restoreColumnLayout({
      current: { a: 0, b: 50, c: 50 },
      panelId: 'a',
      remembered: 5,
      collapsedPanelIds: new Set(),
      minOpenShare: 40,
    })
    expect(layout.a).toBe(40)
  })
})
