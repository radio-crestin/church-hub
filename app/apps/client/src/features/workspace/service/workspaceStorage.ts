import type { WorkspaceLayout } from '../types'

/**
 * localStorage key holding *which panel sits where* for one workspace. Panel
 * sizes live under a separate, panel-group-owned key (see `sizesStorageKey`).
 *
 * Like divider positions, a workspace arrangement is a personal, per-device UI
 * preference: it never round-trips through the database, so one operator's
 * layout can never change another's.
 */
export function layoutStorageKey(workspaceId: string): string {
  return `workspace.${workspaceId}.layout`
}

/** Namespace under which `useDefaultLayout` persists a group's panel sizes. */
export function sizesStorageKey(workspaceId: string, groupId: string): string {
  return `workspace.${workspaceId}.sizes.${groupId}`
}

/** Reads a stored arrangement, or `null` when there is none / it is unusable. */
export function readWorkspaceLayout(
  workspaceId: string,
): WorkspaceLayout | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(layoutStorageKey(workspaceId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkspaceLayout
    if (!Array.isArray(parsed?.columns)) return null
    const columns = parsed.columns.filter(
      (column) =>
        typeof column?.id === 'string' && Array.isArray(column?.panelIds),
    )
    return columns.length > 0 ? { columns } : null
  } catch {
    // Corrupt or unavailable storage — fall back to the page's default layout.
    return null
  }
}

/** Persists an arrangement. Failures are ignored: this is non-critical UI state. */
export function writeWorkspaceLayout(
  workspaceId: string,
  layout: WorkspaceLayout,
): void {
  try {
    window.localStorage.setItem(
      layoutStorageKey(workspaceId),
      JSON.stringify(layout),
    )
  } catch {
    // Ignore quota/availability errors.
  }
}

/** Forgets an arrangement so the page's default layout applies again. */
export function clearWorkspaceLayout(workspaceId: string): void {
  try {
    window.localStorage.removeItem(layoutStorageKey(workspaceId))
    // Written by older versions, which brought a row back at whatever height
    // it once had. Nothing reads it now, but a reset should still sweep it up.
    window.localStorage.removeItem(`workspace.${workspaceId}.heights`)
  } catch {
    // Ignore availability errors.
  }
}
