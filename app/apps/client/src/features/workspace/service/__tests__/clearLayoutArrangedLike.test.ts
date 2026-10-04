import { beforeEach, describe, expect, it } from 'vitest'

import type { WorkspaceLayout } from '../../types'
import { clearLayoutArrangedLike } from '../clearLayoutArrangedLike'
import { readWorkspaceLayout, writeWorkspaceLayout } from '../workspaceStorage'

const PREVIOUS: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['slides'] },
    { id: 'col-2', panelIds: ['control'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

describe('clearLayoutArrangedLike', () => {
  beforeEach(() => window.localStorage.clear())

  it('forgets a stored arrangement equal to the previous default', () => {
    // Column ids may differ (a drag renames them): only the order counts.
    writeWorkspaceLayout('page', {
      columns: PREVIOUS.columns.map((column, i) => ({
        ...column,
        id: `other-${i}`,
      })),
    })
    expect(clearLayoutArrangedLike('page', PREVIOUS)).toBe(true)
    expect(readWorkspaceLayout('page')).toBeNull()
  })

  it('keeps an arrangement the operator chose', () => {
    const chosen: WorkspaceLayout = {
      columns: [
        { id: 'col-1', panelIds: ['slides', 'versions'] },
        { id: 'col-2', panelIds: ['control'] },
        { id: 'col-3', panelIds: ['bookmarks', 'schedules'] },
      ],
    }
    writeWorkspaceLayout('page', chosen)
    expect(clearLayoutArrangedLike('page', PREVIOUS)).toBe(false)
    expect(readWorkspaceLayout('page')).toEqual(chosen)
  })

  it('does nothing when nothing is stored', () => {
    expect(clearLayoutArrangedLike('page', PREVIOUS)).toBe(false)
  })
})
