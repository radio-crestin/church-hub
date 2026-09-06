import { useCallback, useEffect, useMemo, useState } from 'react'

import { moveWorkspacePanel } from '../service/moveWorkspacePanel'
import { reconcileWorkspaceLayout } from '../service/reconcileWorkspaceLayout'
import {
  clearWorkspaceLayout,
  readWorkspaceLayout,
  writeWorkspaceLayout,
} from '../service/workspaceStorage'
import type { WorkspaceDropTarget, WorkspaceLayout } from '../types'

interface UseWorkspaceLayoutResult {
  layout: WorkspaceLayout
  /** Drops `panelId` onto `target`, persisting the result. */
  movePanel: (panelId: string, target: WorkspaceDropTarget) => void
  /** Restores the page's default arrangement. */
  resetLayout: () => void
  /** `true` while the arrangement differs from the page default. */
  isCustomised: boolean
}

/** Comparable snapshot of *which panel sits where*, ignoring column ids. */
function panelOrder(layout: WorkspaceLayout): string {
  return layout.columns.map((column) => column.panelIds.join(',')).join('|')
}

/**
 * Owns *where each panel sits* for one workspace, restored from localStorage on
 * mount and re-reconciled whenever the set of available panels changes (a
 * permission granted, a panel added). Panel *sizes* are owned separately by the
 * resizable panel groups themselves.
 */
export function useWorkspaceLayout(
  workspaceId: string,
  fallback: WorkspaceLayout,
  availableIds: readonly string[],
): UseWorkspaceLayoutResult {
  // Keyed on the id list rather than the array identity, which is new on every
  // render and would restart reconciliation forever.
  const availableKey = availableIds.join('|')
  const ids = useMemo(
    () => (availableKey === '' ? [] : availableKey.split('|')),
    [availableKey],
  )

  const defaultLayout = useMemo(
    () => reconcileWorkspaceLayout(null, fallback, ids),
    [fallback, ids],
  )

  const [layout, setLayout] = useState<WorkspaceLayout>(() =>
    reconcileWorkspaceLayout(readWorkspaceLayout(workspaceId), fallback, ids),
  )

  useEffect(() => {
    setLayout((current) => {
      const next = reconcileWorkspaceLayout(current, fallback, ids)
      return panelOrder(next) === panelOrder(current) ? current : next
    })
  }, [fallback, ids])

  const movePanel = useCallback(
    (panelId: string, target: WorkspaceDropTarget) => {
      setLayout((current) => {
        const next = moveWorkspacePanel(current, panelId, target)
        if (next !== current) writeWorkspaceLayout(workspaceId, next)
        return next
      })
    },
    [workspaceId],
  )

  const resetLayout = useCallback(() => {
    clearWorkspaceLayout(workspaceId)
    setLayout(defaultLayout)
  }, [defaultLayout, workspaceId])

  return {
    layout,
    movePanel,
    resetLayout,
    isCustomised: panelOrder(layout) !== panelOrder(defaultLayout),
  }
}
