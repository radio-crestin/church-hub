import { eq, inArray, sql } from 'drizzle-orm'

import { findLibraryVersions } from './song-versions/findLibraryVersions'
import type {
  OperationResult,
  SongGroup,
  SongGroupMember,
  SongGroupWithMembers,
  SongVersionSuggestion,
} from './types'
import { getDatabase } from '../../db'
import { songCategories, songGroups, songSlides, songs } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-groups')

// Shape of a `songGroups` row as Drizzle's `db.select()` returns it: keyed by
// the schema's camelCase field names (NOT the snake_case SQL columns), with
// timestamp-mode columns hydrated to `Date`.
interface GroupRow {
  id: number
  canonicalTitle: string
  primarySongId: number | null
  createdAt: number | Date
  updatedAt: number | Date
}

function toGroup(row: GroupRow, memberSongIds: number[]): SongGroup {
  return {
    id: row.id,
    canonicalTitle: row.canonicalTitle,
    primarySongId: row.primarySongId,
    memberSongIds,
    createdAt:
      row.createdAt instanceof Date
        ? Math.floor(row.createdAt.getTime() / 1000)
        : (row.createdAt as number),
    updatedAt:
      row.updatedAt instanceof Date
        ? Math.floor(row.updatedAt.getTime() / 1000)
        : (row.updatedAt as number),
  }
}

/**
 * Returns the group + the songs in it. Returns null when the song is not
 * grouped (a standalone song is implicitly its own canonical version, so the
 * UI just renders the song normally and hides the versions panel).
 */
export function getGroupForSong(songId: number): SongGroupWithMembers | null {
  try {
    const db = getDatabase()
    const song = db
      .select({ songGroupId: songs.songGroupId })
      .from(songs)
      .where(eq(songs.id, songId))
      .get()

    if (!song?.songGroupId) return null

    return getSongGroupWithMembers(song.songGroupId)
  } catch (error) {
    logger.error(`getGroupForSong(${songId}) failed: ${error}`)
    return null
  }
}

/**
 * Loads a group with its full member list (titles + a few display fields).
 *
 * Self-heals stale groups (≤ 1 member) on the way out. These appear when
 * a member song gets deleted via `DELETE /api/songs/:id` — the FK on
 * `songs.song_group_id` is `ON DELETE SET NULL`, so deleting one of two
 * members detaches the other but leaves the `song_groups` row behind
 * pointing at a single survivor. That orphan group used to surface in
 * the panel as "Alte versiuni (1)" with only the current song listed
 * (i.e. a "group of me alone"), which is confusing. We collapse it to
 * a standalone song on the spot.
 */
export function getSongGroupWithMembers(
  groupId: number,
): SongGroupWithMembers | null {
  try {
    const db = getDatabase()
    const groupRow = db
      .select()
      .from(songGroups)
      .where(eq(songGroups.id, groupId))
      .get() as GroupRow | undefined

    if (!groupRow) return null

    const memberRows = db
      .select({
        id: songs.id,
        title: songs.title,
        hymnNumber: songs.hymnNumber,
        author: songs.author,
        keyLine: songs.keyLine,
        categoryName: songCategories.name,
      })
      .from(songs)
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .where(eq(songs.songGroupId, groupId))
      .orderBy(songs.title)
      .all()

    if (memberRows.length < 2) {
      collapseStaleGroup(
        groupId,
        memberRows.map((m) => m.id),
      )
      return null
    }

    const members: SongGroupMember[] = memberRows.map((m) => ({
      songId: m.id,
      title: m.title,
      isPrimary: groupRow.primarySongId === m.id,
      hymnNumber: m.hymnNumber ?? null,
      author: m.author ?? null,
      keyLine: m.keyLine ?? null,
      categoryName: m.categoryName ?? null,
    }))

    return {
      ...toGroup(
        groupRow,
        members.map((m) => m.songId),
      ),
      members,
    }
  } catch (error) {
    logger.error(`getSongGroupWithMembers(${groupId}) failed: ${error}`)
    return null
  }
}

/**
 * Removes the orphaned `song_groups` row and detaches the lone survivor
 * (if any). Idempotent — safe to call on a group that's already gone.
 * Logged at info so it shows up in the post-mortem trail if the operator
 * starts seeing groups vanish.
 */
function collapseStaleGroup(
  groupId: number,
  surviving: readonly number[],
): void {
  const db = getDatabase()
  if (surviving.length === 1) {
    db.update(songs)
      .set({ songGroupId: null })
      .where(eq(songs.id, surviving[0]))
      .run()
  }
  db.delete(songGroups).where(eq(songGroups.id, groupId)).run()
  logger.info(
    `Auto-collapsed stale group ${groupId} (${surviving.length} surviving member${surviving.length === 1 ? '' : 's'})`,
  )
}

/**
 * Cleans up groups that lost members after `deleteSong` / `deleteSongsByIds`.
 * Looks at the groups the just-deleted songs belonged to, drops any that
 * are now empty, and collapses any that have a single survivor. Called
 * AFTER the row delete (which nulls the FK via `ON DELETE SET NULL`), so
 * we read the current state of `songs.song_group_id` to know who's left.
 */
export function cleanupGroupsAfterSongDelete(
  affectedGroupIds: readonly number[],
): void {
  if (affectedGroupIds.length === 0) return
  try {
    const db = getDatabase()
    for (const groupId of affectedGroupIds) {
      const remaining = db
        .select({ id: songs.id })
        .from(songs)
        .where(eq(songs.songGroupId, groupId))
        .all()
      if (remaining.length < 2) {
        collapseStaleGroup(
          groupId,
          remaining.map((r) => r.id),
        )
      }
    }
  } catch (error) {
    logger.error(`cleanupGroupsAfterSongDelete failed: ${error}`)
  }
}

/**
 * Returns the (distinct) group ids the given songs currently belong to.
 * Used by `deleteSong` / `deleteSongsByIds` to snapshot membership BEFORE
 * the delete so the post-delete cleanup knows where to look.
 */
export function getGroupIdsForSongs(songIds: readonly number[]): number[] {
  if (songIds.length === 0) return []
  try {
    const db = getDatabase()
    const rows = db
      .select({ songGroupId: songs.songGroupId })
      .from(songs)
      .where(inArray(songs.id, [...songIds]))
      .all()
    const set = new Set<number>()
    for (const r of rows) {
      if (r.songGroupId != null) set.add(r.songGroupId)
    }
    return [...set]
  } catch (error) {
    logger.error(`getGroupIdsForSongs failed: ${error}`)
    return []
  }
}

/**
 * Creates a new group around `primarySongId`, using its title as the
 * canonical title. The song is the sole member until other songs are added
 * via `addSongToGroup` or `linkSongs`.
 */
function createGroupForSong(primarySongId: number): number {
  const db = getDatabase()
  const song = db
    .select({ title: songs.title })
    .from(songs)
    .where(eq(songs.id, primarySongId))
    .get()

  if (!song) throw new Error(`Song ${primarySongId} not found`)

  const inserted = db
    .insert(songGroups)
    .values({
      canonicalTitle: song.title,
      primarySongId,
    })
    .returning({ id: songGroups.id })
    .get()

  db.update(songs)
    .set({ songGroupId: inserted.id })
    .where(eq(songs.id, primarySongId))
    .run()

  logger.info(
    `Created group ${inserted.id} around song ${primarySongId} ("${song.title}")`,
  )
  return inserted.id
}

/**
 * High-level: marks two songs as versions of the same underlying piece.
 *
 *  - If neither is grouped → create a new group with `songIdA` as primary.
 *  - If only one is grouped → add the other to its group.
 *  - If both are grouped (different groups) → merge `groupB` into `groupA`.
 *  - If both are already in the same group → no-op.
 *
 * Returns the resulting group id.
 */
export function linkSongs(songIdA: number, songIdB: number): number {
  if (songIdA === songIdB) {
    throw new Error('Cannot link a song to itself')
  }

  const db = getDatabase()
  const both = db
    .select({ id: songs.id, songGroupId: songs.songGroupId })
    .from(songs)
    .where(inArray(songs.id, [songIdA, songIdB]))
    .all()

  if (both.length !== 2) {
    throw new Error('One or both songs do not exist')
  }

  const a = both.find((s) => s.id === songIdA)
  const b = both.find((s) => s.id === songIdB)
  if (!a || !b) throw new Error('One or both songs do not exist')

  // Same group already
  if (a.songGroupId && a.songGroupId === b.songGroupId) {
    return a.songGroupId
  }

  // Both in different groups → merge B's group into A's
  if (a.songGroupId && b.songGroupId) {
    return mergeGroups(a.songGroupId, b.songGroupId)
  }

  // A has a group, attach B
  if (a.songGroupId) {
    db.update(songs)
      .set({ songGroupId: a.songGroupId })
      .where(eq(songs.id, b.id))
      .run()
    touchGroup(a.songGroupId)
    return a.songGroupId
  }

  // B has a group, attach A
  if (b.songGroupId) {
    db.update(songs)
      .set({ songGroupId: b.songGroupId })
      .where(eq(songs.id, a.id))
      .run()
    touchGroup(b.songGroupId)
    return b.songGroupId
  }

  // Neither grouped — create a new group on A and attach B
  const groupId = createGroupForSong(a.id)
  db.update(songs).set({ songGroupId: groupId }).where(eq(songs.id, b.id)).run()
  return groupId
}

/**
 * Removes a song from its group. If it was the primary, picks the
 * lexicographically first remaining member as the new primary. If no
 * members remain, deletes the group entirely.
 */
export function unlinkSong(songId: number): OperationResult {
  try {
    const db = getDatabase()
    const song = db
      .select({ songGroupId: songs.songGroupId })
      .from(songs)
      .where(eq(songs.id, songId))
      .get()

    if (!song?.songGroupId) {
      return { success: true } // already standalone
    }

    const groupId = song.songGroupId

    db.update(songs)
      .set({ songGroupId: null })
      .where(eq(songs.id, songId))
      .run()

    // If this was the primary, promote another member (or delete the group).
    const group = db
      .select()
      .from(songGroups)
      .where(eq(songGroups.id, groupId))
      .get()

    if (!group) return { success: true }

    const remaining = db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.songGroupId, groupId))
      .orderBy(songs.title)
      .all()

    if (remaining.length === 0) {
      db.delete(songGroups).where(eq(songGroups.id, groupId)).run()
      logger.info(`Deleted empty group ${groupId}`)
      return { success: true }
    }

    // Collapse a 1-member group too — a "group of one" is just a regular song.
    if (remaining.length === 1) {
      db.update(songs)
        .set({ songGroupId: null })
        .where(eq(songs.id, remaining[0].id))
        .run()
      db.delete(songGroups).where(eq(songGroups.id, groupId)).run()
      logger.info(`Collapsed single-member group ${groupId}`)
      return { success: true }
    }

    if (group.primarySongId === songId) {
      db.update(songGroups)
        .set({ primarySongId: remaining[0].id, updatedAt: new Date() })
        .where(eq(songGroups.id, groupId))
        .run()
    } else {
      touchGroup(groupId)
    }

    return { success: true }
  } catch (error) {
    logger.error(`unlinkSong(${songId}) failed: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Marks `songId` as the primary version of its group. The song must already
 * be a member of the group.
 */
export function setPrimarySong(
  groupId: number,
  songId: number,
): OperationResult {
  try {
    const db = getDatabase()
    const song = db
      .select({ songGroupId: songs.songGroupId })
      .from(songs)
      .where(eq(songs.id, songId))
      .get()

    if (!song) {
      return { success: false, error: 'Song not found' }
    }
    if (song.songGroupId !== groupId) {
      return { success: false, error: 'Song is not a member of this group' }
    }

    db.update(songGroups)
      .set({ primarySongId: songId, updatedAt: new Date() })
      .where(eq(songGroups.id, groupId))
      .run()

    logger.info(`Group ${groupId}: primary set to song ${songId}`)
    return { success: true }
  } catch (error) {
    logger.error(`setPrimarySong(${groupId}, ${songId}) failed: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Moves all members of `fromGroupId` into `intoGroupId`, then deletes the
 * empty source group. Keeps the destination group's primary.
 */
export function mergeGroups(intoGroupId: number, fromGroupId: number): number {
  if (intoGroupId === fromGroupId) return intoGroupId

  const db = getDatabase()
  db.update(songs)
    .set({ songGroupId: intoGroupId })
    .where(eq(songs.songGroupId, fromGroupId))
    .run()
  db.delete(songGroups).where(eq(songGroups.id, fromGroupId)).run()
  touchGroup(intoGroupId)
  logger.info(`Merged group ${fromGroupId} into ${intoGroupId}`)
  return intoGroupId
}

function touchGroup(groupId: number): void {
  const db = getDatabase()
  db.update(songGroups)
    .set({ updatedAt: new Date() })
    .where(eq(songGroups.id, groupId))
    .run()
}

/**
 * Surfaces likely versions of `songId`: songs whose distinctive content
 * (title + lyrics, after Romanian-aware stopword removal and ASCII fold)
 * overlaps enough to merit "is this the same song?". On-demand; the
 * request-time cost is two FTS queries + a couple of batched fetches +
 * an in-memory rerank.
 *
 * Candidates come from TWO recall passes that are then merged and reranked:
 *  1. Title FTS — finds same/similar-titled versions.
 *  2. Lyrics FTS — finds RE-TITLED versions (different name, same verses).
 *     Without this pass a version whose title was rewritten would never even
 *     be considered, because the title query can't reach it.
 *
 * Filtered out:
 *  - the song itself,
 *  - songs already in the same group,
 *  - songs whose score is below `minScore` (default `0.55`, chosen so e.g.
 *    "Doamne mai vreau Rusalii cu limbi de foc" no longer pulls in unrelated
 *    "Doamne nu mai vreau nimic" through filler-word inflation). A pure-lyrics
 *    match scores its raw lyrics Jaccard, so the operator's "verses match more
 *    than 70%" rule is what surfaces a re-titled version.
 */
export function getSimilarSongs(
  songId: number,
  limit = 5,
  minScore = 0.55,
): SongVersionSuggestion[] {
  try {
    const db = getDatabase()
    const subject = db
      .select({
        title: songs.title,
        songGroupId: songs.songGroupId,
      })
      .from(songs)
      .where(eq(songs.id, songId))
      .get()

    if (!subject) return []

    // Exclusion set: self + current group siblings (already-resolved versions
    // — suggesting them again is noise the operator already dealt with).
    const exclude = new Set<number>([songId])
    if (subject.songGroupId) {
      const groupMembers = db
        .select({ id: songs.id })
        .from(songs)
        .where(eq(songs.songGroupId, subject.songGroupId))
        .all()
      for (const m of groupMembers) exclude.add(m.id)
    }

    // Subject lyrics — needed for the lyrics-recall query AND the rerank.
    const subjectSlides = db
      .select({ content: songSlides.content })
      .from(songSlides)
      .where(eq(songSlides.songId, songId))
      .all()
    const subjectLyrics = subjectSlides.map((s) => s.content).join(' ')

    return findLibraryVersions(subject.title, subjectLyrics, {
      limit,
      minScore,
      excludeSongIds: [...exclude],
    })
  } catch (error) {
    logger.error(`getSimilarSongs(${songId}) failed: ${error}`)
    return []
  }
}

/**
 * Convenience: returns the per-song version count for a list of song ids.
 * Used by list views to show a "3 versions" badge without an extra round-trip
 * per row. Result is keyed by song id; absent ids are standalone (no group).
 */
export function getVersionCounts(
  songIds: number[],
): Map<number, { groupId: number; count: number }> {
  const result = new Map<number, { groupId: number; count: number }>()
  if (songIds.length === 0) return result

  try {
    const db = getDatabase()
    const rows = db
      .select({
        songId: songs.id,
        groupId: songs.songGroupId,
        count: sql<number>`(SELECT COUNT(*) FROM songs s2 WHERE s2.song_group_id = ${songs.songGroupId})`,
      })
      .from(songs)
      .where(inArray(songs.id, songIds))
      .all()

    for (const r of rows) {
      if (r.groupId) {
        result.set(r.songId, { groupId: r.groupId, count: r.count })
      }
    }
    return result
  } catch (error) {
    logger.error(`getVersionCounts failed: ${error}`)
    return result
  }
}
