import { eq, inArray, sql } from 'drizzle-orm'

import { searchSongs } from './search'
import type {
  OperationResult,
  SongGroup,
  SongGroupMember,
  SongGroupWithMembers,
  SongVersionSuggestion,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
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
 * Romanian function-word + filler vocabulary stripped before computing
 * title/lyrics overlap. The list is intentionally conservative — we only
 * drop words that recur across nearly every hymn ("doamne", "iisus" are
 * deliberately KEPT because they DO carry signal between hymn variants of
 * the same prayer, just less than a distinctive noun like "rusalii"). The
 * goal is to suppress filler like "să / și / nu / mai" that previously
 * inflated bigram similarity on titles like "Doamne mai vreau X" vs
 * "Doamne nu mai vreau Y".
 *
 * Entries are in ASCII form (post-fold), matching `tokenize()`.
 */
const RO_STOPWORDS: ReadonlySet<string> = new Set([
  // Articles & determiners
  'o',
  'un',
  'una',
  'unei',
  'unui',
  'unele',
  'unii',
  'niste',
  'cel',
  'cea',
  'cei',
  'cele',
  'asta',
  'asa',
  'aceea',
  'acela',
  'acesta',
  'aceasta',
  'acesti',
  'aceste',
  // Prepositions
  'in',
  'la',
  'cu',
  'de',
  'pe',
  'din',
  'pana',
  'spre',
  'sub',
  'fara',
  'pentru',
  'peste',
  'catre',
  'prin',
  'intre',
  // Conjunctions / connectives
  'si',
  'sau',
  'dar',
  'iar',
  'ori',
  'nici',
  'ca',
  'sa',
  'caci',
  'deci',
  // Personal pronouns (full and clitic, ASCII-folded)
  'eu',
  'tu',
  'el',
  'ea',
  'noi',
  'voi',
  'ei',
  'ele',
  'ma',
  'te',
  'se',
  'ne',
  'va',
  'mi',
  'ti',
  'ii',
  'le',
  'mie',
  'tie',
  'sie',
  'mine',
  'tine',
  'sine',
  // Possessives + their connective particles
  'meu',
  'mea',
  'mei',
  'mele',
  'tau',
  'ta',
  'tai',
  'tale',
  'sau',
  'sa',
  'sai',
  'sale',
  'al',
  'ai',
  'ale',
  'isi',
  // Auxiliaries / be-forms
  'a',
  'am',
  'ai',
  'au',
  'as',
  'ar',
  'aveti',
  'avem',
  'va',
  'vor',
  'voi',
  'e',
  'esti',
  'este',
  'sunt',
  'era',
  'eram',
  'erau',
  'fi',
  'fie',
  'fii',
  'fost',
  // Negation & modal/quantifier fillers
  'nu',
  'mai',
  'doar',
  'tot',
  'toata',
  'toti',
  'toate',
  'cam',
  'chiar',
  // Interrogatives — rarely the distinctive word of a hymn
  'ce',
  'cum',
  'cand',
  'unde',
  'cine',
  'care',
])

/**
 * Lowercase + NFD strip diacritics + cedilla→comma legacy fold +
 * non-alphanumeric → space + collapse whitespace. This matches what the
 * Romanian hymn corpus needs to be compared apples-to-apples regardless of
 * whether the typist used diacritics, old vs new Unicode for ț/ș, or extra
 * punctuation.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ţş]/g, (m) => (m === 'ţ' ? 't' : 's'))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  const n = normalize(s)
  if (!n) return []
  return n.split(' ').filter((t) => t.length > 0)
}

/**
 * Drops stopwords + single-character noise from a token list. Returns the
 * content-word set used for the precision-tight Jaccard pass.
 */
function contentWords(toks: readonly string[]): Set<string> {
  const set = new Set<string>()
  for (const t of toks) {
    if (t.length < 2) continue
    if (RO_STOPWORDS.has(t)) continue
    set.add(t)
  }
  return set
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * Lyrics overlap (Jaccard of content words) at or above this is treated as a
 * re-titled version even when the titles share no distinctive word. Matches
 * the operator's "more than 70% of the verses are the same" rule.
 */
const LYRICS_MATCH_THRESHOLD = 0.7

/**
 * A pure-lyrics match (no title overlap) must be backed by at least this many
 * distinct content words on BOTH sides. Guards against degenerate matches
 * between trivially short songs — e.g. two different one-line "Aleluia"
 * choruses would otherwise score 1.0 on a single shared word.
 */
const MIN_LYRICS_CONTENT_WORDS = 4

/** Cap on how many distinct lyric terms feed the recall FTS query, so a very
 * long hymn can't exceed FTS5's expression-size limit. */
const LYRICS_RECALL_TERM_CAP = 60

/** How many lyrics-recall candidates to pull before the precision rerank. */
const LYRICS_RECALL_LIMIT = 30

/**
 * Builds the FTS5 MATCH expression that recalls songs sharing the subject's
 * *verse* vocabulary, restricted to the `content` (lyrics) column so a shared
 * category name or title word can't leak in. Terms are the subject's
 * distinctive lyric words (Romanian stopwords + diacritics already stripped by
 * `contentWords`), longest-first (longer words are rarer / more selective) and
 * capped at `LYRICS_RECALL_TERM_CAP`. Returns '' when the subject has no usable
 * lyric words, in which case the caller skips the lyrics pass.
 */
export function buildLyricsRecallMatchQuery(
  subjectLyricToks: readonly string[],
): string {
  const words = [...contentWords(subjectLyricToks)].sort(
    (a, b) => b.length - a.length,
  )
  if (words.length === 0) return ''
  const terms = words.slice(0, LYRICS_RECALL_TERM_CAP)
  return `{content} : (${terms.map((t) => `"${t}"`).join(' OR ')})`
}

/**
 * Returns up to `LYRICS_RECALL_LIMIT` song ids whose lyrics overlap the
 * subject's verse vocabulary, ranked by FTS relevance. This is the recall pass
 * that lets a *re-titled* version (different name, same verses) reach the
 * precision rerank in `getSimilarSongs`; a title-only FTS query can never find
 * it. The broad recall is fine — the Jaccard rerank is what enforces the
 * ">70% of the verses match" bar.
 */
function recallByLyrics(subjectLyricToks: readonly string[]): number[] {
  const match = buildLyricsRecallMatchQuery(subjectLyricToks)
  if (!match) return []
  try {
    const raw = getRawDatabase()
    const rows = raw
      .query<{ song_id: number }, [string, number]>(
        'SELECT song_id FROM songs_fts WHERE songs_fts MATCH ? ORDER BY rank LIMIT ?',
      )
      .all(match, LYRICS_RECALL_LIMIT)
    return rows.map((r) => r.song_id)
  } catch (error) {
    logger.error(`recallByLyrics failed: ${error}`)
    return []
  }
}

/**
 * Computes the version-likelihood score between two songs. Combines:
 *  - Content-word title Jaccard (60%) — distinctive words after stripping
 *    Romanian filler; falls back to full-token Jaccard when the title is
 *    pure filler (e.g. "Doamne miluiește") so identical titles still match.
 *  - Content-word lyrics Jaccard (40%) — catches versions whose title was
 *    rewritten but whose lyrics still share most of the vocabulary.
 *
 * A hard precision filter then rejects pairs that share NO distinctive
 * title word AND have lyrics overlap below `LYRICS_MATCH_THRESHOLD` — that
 * combination is the shape of an accidental match (common Romanian filler in
 * titles, no content overlap at all).
 */
export function scoreVersionLikelihood(
  subjectTitleToks: readonly string[],
  subjectLyricToks: readonly string[],
  candidateTitle: string,
  candidateLyrics: string,
): { score: number; reason: SongVersionSuggestion['reason'] } {
  const subjTitleSet = contentWords(subjectTitleToks)
  const candTitleToks = tokenize(candidateTitle)
  const candTitleSet = contentWords(candTitleToks)

  // Filler-only titles fall back to full-token Jaccard.
  const useFallback = subjTitleSet.size === 0 || candTitleSet.size === 0
  const titleSim = useFallback
    ? jaccard(new Set(subjectTitleToks), new Set(candTitleToks))
    : jaccard(subjTitleSet, candTitleSet)

  const subjLyricSet = contentWords(subjectLyricToks)
  const candLyricSet = contentWords(tokenize(candidateLyrics))
  const lyricsSim = jaccard(subjLyricSet, candLyricSet)

  // Precision filter — kill matches that share no distinctive title word
  // unless the lyrics are nearly identical (a rewritten-title version).
  const hasTitleContentOverlap =
    !useFallback && [...subjTitleSet].some((w) => candTitleSet.has(w))
  if (!hasTitleContentOverlap && lyricsSim < LYRICS_MATCH_THRESHOLD) {
    return { score: 0, reason: 'mixed' }
  }

  // Pure-lyrics match: titles share no distinctive word, but the lyrics
  // are nearly identical → this is a translated / paraphrased title. Give
  // the lyrics signal full credit instead of diluting it via the blended
  // formula (which would average in a zero title score).
  if (!hasTitleContentOverlap) {
    // Require enough distinct verse vocabulary on both sides so two trivially
    // short songs that share one word (e.g. "Aleluia") can't score as a match.
    if (
      subjLyricSet.size < MIN_LYRICS_CONTENT_WORDS ||
      candLyricSet.size < MIN_LYRICS_CONTENT_WORDS
    ) {
      return { score: 0, reason: 'lyrics' }
    }
    return { score: lyricsSim, reason: 'lyrics' }
  }

  const blended = 0.6 * titleSim + 0.4 * lyricsSim
  const reason: SongVersionSuggestion['reason'] =
    titleSim >= 0.7 ? 'title' : lyricsSim >= 0.5 ? 'lyrics' : 'mixed'
  return { score: blended, reason }
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
    const subjectTitleToks = tokenize(subject.title)
    const subjectLyricToks = tokenize(subjectLyrics)

    // 1) Title recall — cheap FTS over title/category/content using the title
    //    as the query. Understands diacritic folding + hymn numbers.
    const titleCandidates = searchSongs(subject.title, undefined, 30).filter(
      (c) => !exclude.has(c.id),
    )

    // 2) Lyrics recall — FTS over the lyrics column using the subject's verse
    //    vocabulary. Surfaces re-titled versions the title pass can't reach.
    const lyricsCandidateIds = recallByLyrics(subjectLyricToks).filter(
      (id) => !exclude.has(id),
    )

    // 3) Merge into one candidate set carrying title + category metadata.
    //    Title candidates already have it; lyrics-only ids need a small fetch.
    const candidateMeta = new Map<
      number,
      { title: string; categoryName: string | null }
    >()
    for (const c of titleCandidates) {
      candidateMeta.set(c.id, { title: c.title, categoryName: c.categoryName })
    }
    const missingMetaIds = lyricsCandidateIds.filter(
      (id) => !candidateMeta.has(id),
    )
    if (missingMetaIds.length > 0) {
      const metaRows = db
        .select({
          id: songs.id,
          title: songs.title,
          categoryName: songCategories.name,
        })
        .from(songs)
        .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
        .where(inArray(songs.id, missingMetaIds))
        .all()
      for (const r of metaRows) {
        candidateMeta.set(r.id, {
          title: r.title,
          categoryName: r.categoryName,
        })
      }
    }
    if (candidateMeta.size === 0) return []

    const candidateIds = [...candidateMeta.keys()]

    // 4) Batch-fetch candidate lyrics (one query for every candidate).
    const slidesBySongId = db
      .select({
        songId: songSlides.songId,
        content: songSlides.content,
      })
      .from(songSlides)
      .where(inArray(songSlides.songId, candidateIds))
      .all()
    const lyricsBySongId = new Map<number, string>()
    for (const row of slidesBySongId) {
      const prev = lyricsBySongId.get(row.songId) ?? ''
      lyricsBySongId.set(
        row.songId,
        prev ? `${prev} ${row.content}` : row.content,
      )
    }

    // 5) Score each candidate with the title+lyrics likelihood model.
    const rescored = candidateIds
      .map((id) => {
        const meta = candidateMeta.get(id)
        if (!meta) return null
        const { score, reason } = scoreVersionLikelihood(
          subjectTitleToks,
          subjectLyricToks,
          meta.title,
          lyricsBySongId.get(id) ?? '',
        )
        return {
          songId: id,
          title: meta.title,
          hymnNumber: null as string | null,
          author: null as string | null,
          categoryName: meta.categoryName,
          keyLine: null as string | null,
          score: Math.round(score * 100) / 100,
          reason,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    if (rescored.length === 0) return []

    // 6) Hydrate hymnNumber + author + keyLine ("gama melodie") for the
    //    surviving candidates so the UI can show a key + category tag per row.
    const ids = rescored.map((r) => r.songId)
    const extras = db
      .select({
        id: songs.id,
        hymnNumber: songs.hymnNumber,
        author: songs.author,
        keyLine: songs.keyLine,
      })
      .from(songs)
      .where(inArray(songs.id, ids))
      .all()
    const extrasById = new Map(extras.map((e) => [e.id, e]))
    return rescored.map((r) => {
      const e = extrasById.get(r.songId)
      return e
        ? {
            ...r,
            hymnNumber: e.hymnNumber,
            author: e.author,
            keyLine: e.keyLine,
          }
        : r
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
