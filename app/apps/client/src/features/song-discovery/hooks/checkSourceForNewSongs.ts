import type { QueryClient } from '@tanstack/react-query'

import { backfillAlternateTitles } from '~/features/songs/service'
import { catalogQueryKey } from './useFetchCatalog'
import { fetchSourceCatalog, type SongSource } from '../providers'
import { countNewCandidates } from '../service/discoveryApi'
import { getSourceChecksum } from '../service/songSourcesApi'
import { alternateTitleEntries } from '../utils/alternateTitleEntries'
import { shouldRecoverTitles } from '../utils/shouldRecoverTitles'

/** Minimum gap between real catalog checks — the user asked for a daily cadence. */
export const MIN_CHECK_GAP_MS = 1000 * 60 * 60 * 24

/**
 * The source whose catalogue gives library songs back their real names (a
 * library imported with "use the first verse as the title" lost them).
 */
const TITLES_SOURCE_ID = 'resurse-crestine'
/** The catalogue the songs' real names were last taken from. */
const TITLES_SIGNATURE_KEY = 'song-discovery-titles-signature'
/**
 * When recovering those names was last attempted, successfully or not: a
 * recovery that keeps failing waits out the daily gap instead of pulling the
 * multi-MB catalogue down on every launch.
 */
const TITLES_ATTEMPTED_KEY = 'song-discovery-titles-attempted'

/** What the last check of one source found, kept across launches. */
export interface SourceCheck {
  /** The source's checksum ('' when it offers none). */
  signature: string
  /** Songs in the catalogue the library lacks. */
  count: number
  checkedAt: number
}

const stateKey = (sourceId: string) => `song-discovery-source:${sourceId}`

export function readSourceCheck(sourceId: string): SourceCheck {
  try {
    const raw = localStorage.getItem(stateKey(sourceId))
    if (raw) return JSON.parse(raw) as SourceCheck
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a corrupt entry is re-checked
    console.warn('[song-discovery] Unreadable check state, re-checking', error)
  }
  return { signature: '', count: 0, checkedAt: 0 }
}

export function writeSourceCheck(sourceId: string, check: SourceCheck) {
  localStorage.setItem(stateKey(sourceId), JSON.stringify(check))
}

function readNumber(key: string): number {
  const n = Number(localStorage.getItem(key) ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Gives library songs back the names the catalogue knows them by. */
async function recoverTitles(
  candidates: Parameters<typeof alternateTitleEntries>[0],
  signature: string,
) {
  // Recorded before the attempt, so a run that dies partway still counts.
  localStorage.setItem(TITLES_ATTEMPTED_KEY, String(Date.now()))
  try {
    await backfillAlternateTitles(alternateTitleEntries(candidates))
    localStorage.setItem(TITLES_SIGNATURE_KEY, signature)
  } catch (error) {
    // Left for the next check: the count is what the operator waits on.
    // biome-ignore lint/suspicious/noConsole: logged, retried next check
    console.warn('[song-discovery] Recovering song names failed', error)
  }
}

/**
 * Checks one source for songs the library lacks. Cheap by design: a checksum
 * that matches the last check skips the download; a source without one is
 * downloaded at most daily. `force` always downloads ("Check now").
 * The downloaded catalogue primes Song discovery's cache.
 */
export async function checkSourceForNewSongs(
  source: SongSource,
  queryClient: QueryClient,
  force: boolean,
): Promise<SourceCheck> {
  const previous = readSourceCheck(source.id)
  const now = Date.now()
  const signature = await getSourceChecksum(source.id)
  const titlesDue =
    source.id === TITLES_SOURCE_ID &&
    shouldRecoverTitles({
      recoveredSignature: localStorage.getItem(TITLES_SIGNATURE_KEY),
      nextSignature: signature,
      attemptedAt: readNumber(TITLES_ATTEMPTED_KEY),
      now,
      gapMs: MIN_CHECK_GAP_MS,
    })

  const unchanged = signature !== '' && signature === previous.signature
  const checkedRecently =
    signature === '' &&
    previous.checkedAt > 0 &&
    now - previous.checkedAt < MIN_CHECK_GAP_MS
  let next: SourceCheck
  if (!force && !titlesDue && (unchanged || checkedRecently)) {
    next = { ...previous, checkedAt: unchanged ? now : previous.checkedAt }
  } else {
    const candidates = await fetchSourceCatalog(source)
    const count = await countNewCandidates(candidates)
    if (source.id === TITLES_SOURCE_ID) {
      await recoverTitles(candidates, signature)
    }
    queryClient.setQueryData(catalogQueryKey(source.id), candidates)
    next = { signature, count, checkedAt: now }
  }
  writeSourceCheck(source.id, next)
  return next
}
