export type SidebarGroupId = 'live' | 'library' | 'tools'

const GROUP_ORDER: SidebarGroupId[] = ['live', 'library', 'tools']

/** Built-in pages by group; anything else (custom pages too) is a tool. */
const GROUP_OF_PAGE: Record<string, SidebarGroupId> = {
  present: 'live',
  songs: 'library',
  bible: 'library',
  schedules: 'library',
  music: 'library',
  gallery: 'library',
}

/** Splits the sidebar pages into Live / Library / Tools, keeping the operator's order inside each group. */
export function groupSidebarItems<T extends { id: string }>(items: T[]) {
  return GROUP_ORDER.map((id) => ({
    id,
    items: items.filter((item) => (GROUP_OF_PAGE[item.id] ?? 'tools') === id),
  })).filter((group) => group.items.length > 0)
}
