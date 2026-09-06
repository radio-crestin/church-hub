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
    window.localStorage.removeItem(heightsStorageKey(workspaceId))
  } catch {
    // Ignore availability errors.
  }
}

/**
 * localStorage key holding the height each panel returns to when it is
 * expanded again. Kept apart from the group's own size storage, which only
 * ever knows the sizes rows have *right now* — and a collapsed row's height is
 * its header, not the height the operator wants back.
 */
export function heightsStorageKey(workspaceId: string): string {
  return `workspace.${workspaceId}.heights`
}

/** Remembered open heights, as percentages of the column, keyed by panel id. */
export function readPanelHeights(workspaceId: string): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(heightsStorageKey(workspaceId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const heights: Record<string, number> = {}
    for (const [panelId, height] of Object.entries(parsed ?? {})) {
      if (typeof height === 'number' && height > 0 && height <= 100) {
        heights[panelId] = height
      }
    }
    return heights
  } catch {
    // Corrupt or unavailable storage — the panel falls back to its default size.
    return {}
  }
}

/** Records the height `panelId` should come back to, as a percentage (0..100). */
export function writePanelHeight(
  workspaceId: string,
  panelId: string,
  height: number,
): void {
  try {
    window.localStorage.setItem(
      heightsStorageKey(workspaceId),
      JSON.stringify({ ...readPanelHeights(workspaceId), [panelId]: height }),
    )
  } catch {
    // Ignore quota/availability errors.
  }
}
