import { isWebApp } from '~/config'
import { BUILTIN_ITEMS } from '../constants'
import type { SidebarMenuItem } from '../types'

const PC_ONLY_PATHS = Object.values(BUILTIN_ITEMS)
  .filter((definition) => definition.pcOnly)
  .map((definition) => definition.to)

/** A built-in page only the church PC serves (Live Stream, Music, …). */
export function isPcOnlyItem(item: SidebarMenuItem): boolean {
  return (
    item.type === 'builtin' && Boolean(BUILTIN_ITEMS[item.builtinId]?.pcOnly)
  )
}

/** Whether the web app is at a page only the church PC can serve. */
export function isPcOnlyPathInWebApp(pathname: string): boolean {
  return (
    isWebApp &&
    PC_ONLY_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  )
}
