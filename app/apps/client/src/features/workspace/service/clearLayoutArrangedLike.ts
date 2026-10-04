import { panelOrder } from './panelOrder'
import { clearWorkspaceLayout, readWorkspaceLayout } from './workspaceStorage'
import type { WorkspaceLayout } from '../types'

/**
 * Forgets a stored arrangement that is exactly `previousDefault`, so the page's
 * current default applies instead. An arrangement the operator really chose
 * differs from it and is never touched.
 *
 * Used when a page changes where its panels start out: a device still sitting
 * on the old default never picked it, and would otherwise be stuck there.
 */
export function clearLayoutArrangedLike(
  workspaceId: string,
  previousDefault: WorkspaceLayout,
): boolean {
  const stored = readWorkspaceLayout(workspaceId)
  if (!stored || panelOrder(stored) !== panelOrder(previousDefault)) {
    return false
  }
  clearWorkspaceLayout(workspaceId)
  return true
}
