/** The curated Church Hub Library (T-177), as this PC sees it. */

/** Its folder on the sync service and its source id. */
export const CURATED_SOURCE_ID = 'church-hub'

/** How the curated library describes itself in its manifest. */
export const CURATED_LIBRARY_INFO = {
  sourceId: CURATED_SOURCE_ID,
  name: 'Church Hub Library',
  categoryName: 'Church Hub',
  listed: true,
  publisher: 'Church Hub',
}

/** A submission as the service keeps it. */
export interface ServiceSubmission {
  id: string
  submittedAt: number
  title: string
  xml: string
  sourceSongId: string | null
  churchName: string | null
  note: string | null
}

/** A library song like the submission: same lyrics, or the same title. */
export interface LibraryMatch {
  id: string
  title: string
  sameLyrics: boolean
}

/** A submission for the curator page: its slides and its likely duplicates. */
export interface LibrarySubmission {
  id: string
  submittedAt: number
  title: string
  churchName: string | null
  note: string | null
  slides: Array<{ label: string | null; text: string }>
  matches: LibraryMatch[]
}

/** Who is signed in to curate, if anyone. */
export interface CuratorStatus {
  signedIn: boolean
  email: string | null
  curator: boolean
}

export type CuratorDecision =
  | { decision: 'approved' }
  | { decision: 'merged'; librarySongId: string }
  | { decision: 'rejected'; reason: string | null }
