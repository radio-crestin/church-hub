import type { ParsedSong } from '~/features/song-import'
import type { SongMetadata } from '~/features/songs/components/SongDetailsSection'
import type { LocalSlide } from '~/features/songs/components/SongSlideList'
import type { SongVersionSuggestion } from '~/features/songs/types'

/**
 * One external song parsed from a source provider's catalog, before any
 * library comparison. `tempId` is a stable client-side correlation id used to
 * match the server's per-candidate verdict back to this item.
 */
export interface DiscoveryCandidate {
  tempId: string
  parsed: ParsedSong
  sourceFilename: string | null
  sourceFormat: 'opensong' | 'pptx'
}

/** Mirrors the server's `DiscoveryMatchVerdict`. */
export type DiscoveryMatchVerdict =
  | 'exact-filename'
  | 'exact-title'
  | 'similar'
  | 'new'

/** Mirrors the server's `DiscoveryMatchResult` (POST /api/songs/discovery/match). */
export interface DiscoveryMatchResult {
  tempId: string
  verdict: DiscoveryMatchVerdict
  exactSongId: number | null
  similar: SongVersionSuggestion[]
}

/** The operator's per-candidate decision in the staging screen. */
export type DiscoveryDecision = 'pending' | 'approve' | 'skip'

/** Editable draft of a candidate — seeded from `parsed`, committed on import. */
export interface CandidateDraft {
  title: string
  categoryId: number | null
  slides: LocalSlide[]
  metadata: SongMetadata
}

/**
 * A candidate the user lacks (verdict `similar` or `new`), enriched with its
 * library-match verdict and an editable draft. Exact-filename / exact-title
 * candidates are filtered out before staging — the user already has them.
 */
export interface StagingItem {
  tempId: string
  candidate: DiscoveryCandidate
  verdict: DiscoveryMatchVerdict
  similar: SongVersionSuggestion[]
  draft: CandidateDraft
  decision: DiscoveryDecision
}
