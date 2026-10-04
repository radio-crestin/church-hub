import { useState } from 'react'

import { clearLayoutArrangedLike } from '../service/clearLayoutArrangedLike'
import type { WorkspaceLayout } from '../types'

/**
 * Moves a device still on a page's previous default arrangement to the new
 * default, once, before the workspace reads its stored layout. Call it above
 * the `<Workspace>` it belongs to (and above any early return).
 */
export function useDefaultLayoutMigration(
  workspaceId: string,
  previousDefault: WorkspaceLayout,
): void {
  useState(() => clearLayoutArrangedLike(workspaceId, previousDefault))
}
