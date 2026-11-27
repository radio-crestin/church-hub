import { ALL_PERMISSIONS, type Permission } from '../users/types'

/** Marks a screen link's token, so other tokens skip the lookup. */
export const SCREEN_LINK_PREFIX = 'scr_'

/** A link lasts a day: a service and its rehearsal, then it is dead. */
export const SCREEN_LINK_TTL_MS = 24 * 60 * 60 * 1000

/** The synced setting the church's screen links live in (their hashes). */
export const SCREEN_LINKS_KEY = 'screen_links'

/**
 * What a device that opened a screen link may do: read what a screen shows
 * (the presentation, songs, Bible, programs, its screen's settings), never
 * who the church's users are, its logs, or anything that writes.
 */
export const SCREEN_LINK_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (permission) =>
    permission.endsWith('.view') &&
    permission !== 'users.view' &&
    permission !== 'logs.view',
)
