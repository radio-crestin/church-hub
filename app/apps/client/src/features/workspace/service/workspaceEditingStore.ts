/**
 * Which workspaces are in layout-editing mode right now.
 *
 * The switch lives in the page's menu while the drag handles live inside the
 * `Workspace`, and neither of the two renders the other — so instead of
 * threading a flag through every page, both sides read this one tiny store.
 * It is deliberately in-memory: editing is a mode you are in for a moment, not
 * a preference worth remembering across reloads.
 */
const editingWorkspaceIds = new Set<string>()
const listeners = new Set<() => void>()

/** `true` while `workspaceId` is being rearranged. */
export function isWorkspaceEditing(workspaceId: string): boolean {
  return editingWorkspaceIds.has(workspaceId)
}

/** Enters or leaves layout editing for one workspace. */
export function setWorkspaceEditing(
  workspaceId: string,
  editing: boolean,
): void {
  if (editing === editingWorkspaceIds.has(workspaceId)) return
  if (editing) {
    editingWorkspaceIds.add(workspaceId)
  } else {
    editingWorkspaceIds.delete(workspaceId)
  }
  for (const listener of listeners) listener()
}

/** Subscribes to every change; returns the unsubscribe. */
export function subscribeWorkspaceEditing(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
