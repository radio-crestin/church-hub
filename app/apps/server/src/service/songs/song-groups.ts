import { eq, inArray, sql } from 'drizzle-orm'

import { searchSongs } from './search'
import type {
  OperationResult,
  SongGroup,
  SongGroupMember,
  SongGroupWithMembers,
  SongVersionSuggestion,
} from './types'
import { getDatabase } from '../../db'
import { songGroups, songs } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-groups')

interface GroupRow {
  id: number
  canonical_title: string
  primary_song_id: number | null
  created_at: number | Date
  updated_at: number | Date
}

function toGroup(row: GroupRow, memberSongIds: number[]): SongGroup {
  return {
    id: row.id,
    canonicalTitle: row.canonical_title,
    primarySongId: row.primary_song_id,
    memberSongIds,
    createdAt:
      row.created_at instanceof Date
        ? Math.floor(row.created_at.getTime() / 1000)
        : (row.created_at as number),
    updatedAt:
      row.updated_at instanceof Date
        ? Math.floor(row.updated_at.getTime() / 1000)
        : (row.updated_at as number),
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
      })
      .from(songs)
      .where(eq(songs.songGroupId, groupId))
      .orderBy(songs.title)
      .all()

    const members: SongGroupMember[] = memberRows.map((m) => ({
      songId: m.id,
      title: m.title,
      isPrimary: groupRow.primary_song_id === m.id,
      hymnNumber: m.hymnNumber ?? null,
      author: m.author ?? null,
      keyLine: m.keyLine ?? null,
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
 * Normalizes a Romanian song title for similarity comparison: lowercase,
 * fold diacritics + cedilla→comma variants, strip punctuation, collapse
 * whitespace. Kept in sync with the client's `normalize` shape so server
 * and client agree on which titles look "the same".
 */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[ţş]/g, (m) => (m === 'ţ' ? 't' : 's')) // legacy cedilla
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Bigram Jaccard — symmetric, robust to small typos and word reorderings.
 * Returns 0..1.
 */
function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const aSet = bigrams(a)
  const bSet = bigrams(b)
  if (aSet.size === 0 || bSet.size === 0) return 0
  let inter = 0
  for (const g of aSet) if (bSet.has(g)) inter++
  return (2 * inter) / (aSet.size + bSet.size)
}

/**
 * Surfaces likely versions of `songId` — songs whose title (or, by
 * extension via FTS, lyrics) looks similar enough to merit a user prompt
 * "is this the same song?". This is on-demand; the request-time cost is
 * one FTS query + an in-memory rerank over the top hits.
 *
 * Filtered out:
 *  - the song itself,
 *  - songs already in the same group,
 *  - songs with normalized-title bigram similarity below `minScore` (default
 *    `0.45`, which empirically catches "Doamne Te slavesc" ↔ "Doamne, Te
 *    slăvesc" without flooding unrelated titles).
 */
export function getSimilarSongs(
  songId: number,
  limit = 5,
  minScore = 0.45,
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

    const normalizedSubject = normalizeTitle(subject.title)
    if (!normalizedSubject) return []

    // 1) Pull candidates via the existing FTS endpoint with the title as
    //    the query. This already understands diacritic folding, hymn
    //    number lookups, etc., so we piggy-back on it instead of running
    //    a parallel index.
    const rawCandidates = searchSongs(subject.title, undefined, 30)

    // 2) Build the exclusion set: self + group members.
    const exclude = new Set<number>([songId])
    if (subject.songGroupId) {
      const groupMembers = db
        .select({ id: songs.id })
        .from(songs)
        .where(eq(songs.songGroupId, subject.songGroupId))
        .all()
      for (const m of groupMembers) exclude.add(m.id)
    }

    // 3) Rerank by normalized-title bigram similarity. The FTS score is a
    //    decent recall signal but a poor precision signal on title-only
    //    matches; the bigram pass tightens precision.
    const rescored = rawCandidates
      .filter((c) => !exclude.has(c.id))
      .map((c) => {
        const sim = bigramSimilarity(normalizedSubject, normalizeTitle(c.title))
        // Blend FTS rank (0..100 → 0..1) with bigram similarity. Bigram
        // dominates because two similar titles are the strongest signal a
        // human looks at first.
        const blended = 0.75 * sim + 0.25 * (c.score / 100)
        return {
          songId: c.id,
          title: c.title,
          hymnNumber: null as string | null,
          author: null as string | null,
          categoryName: c.categoryName,
          // Cap to two decimal places to avoid noisy 0.7234... in the UI.
          score: Math.round(blended * 100) / 100,
          reason: (sim >= 0.7
            ? 'title'
            : c.score >= 70
              ? 'lyrics'
              : 'mixed') as SongVersionSuggestion['reason'],
        }
      })
      .filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    // 4) Hydrate hymnNumber + author for the surviving candidates (cheap,
    //    bounded by `limit`).
    if (rescored.length === 0) return []
    const ids = rescored.map((r) => r.songId)
    const extras = db
      .select({
        id: songs.id,
        hymnNumber: songs.hymnNumber,
        author: songs.author,
      })
      .from(songs)
      .where(inArray(songs.id, ids))
      .all()
    const extrasById = new Map(extras.map((e) => [e.id, e]))
    return rescored.map((r) => {
      const e = extrasById.get(r.songId)
      return e ? { ...r, hymnNumber: e.hymnNumber, author: e.author } : r
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
