import { useCallback, useSyncExternalStore } from 'react'

import {
  isWorkspaceEditing,
  setWorkspaceEditing,
  subscribeWorkspaceEditing,
} from '../service/workspaceEditingStore'

interface UseWorkspaceEditingResult {
  /** `true` while the page is in layout-editing mode. */
  editing: boolean
  setEditing: (editing: boolean) => void
  toggleEditing: () => void
}

/**
 * Shares one workspace's layout-editing mode between the page's menu (which
 * turns it on) and the workspace itself (which shows the handles).
 */
export function useWorkspaceEditing(
  workspaceId: string,
): UseWorkspaceEditingResult {
  const editing = useSyncExternalStore(
    subscribeWorkspaceEditing,
    () => isWorkspaceEditing(workspaceId),
    () => false,
  )

  const setEditing = useCallback(
    (next: boolean) => setWorkspaceEditing(workspaceId, next),
    [workspaceId],
  )

  const toggleEditing = useCallback(
    () => setWorkspaceEditing(workspaceId, !isWorkspaceEditing(workspaceId)),
    [workspaceId],
  )

  return { editing, setEditing, toggleEditing }
}
