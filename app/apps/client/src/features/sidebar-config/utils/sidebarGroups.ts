import type { SidebarGroupId } from '../types'

export const SIDEBAR_GROUPS: SidebarGroupId[] = ['live', 'library', 'tools']

/** Where a page goes when the operator hasn't chosen: anything not listed (custom pages too) is a tool. */
const DEFAULT_GROUP: Record<string, SidebarGroupId> = {
  present: 'live',
  songs: 'library',
  bible: 'library',
  schedules: 'library',
  music: 'library',
  gallery: 'library',
}

/** The pages the footer draws (Settings, Kiosk) belong to no group. */
const FOOTER_PAGES = new Set(['settings', 'kiosk'])

export function isGroupable(id: string): boolean {
  return !FOOTER_PAGES.has(id)
}

export function groupOf(item: { id: string; group?: SidebarGroupId }) {
  return item.group ?? DEFAULT_GROUP[item.id] ?? 'tools'
}

/** Splits the sidebar pages into its sections, keeping the operator's order inside each. */
export function groupSidebarItems<
  T extends { id: string; group?: SidebarGroupId },
>(items: T[]) {
  return SIDEBAR_GROUPS.map((id) => ({
    id,
    items: items.filter((item) => groupOf(item) === id),
  })).filter((group) => group.items.length > 0)
}
