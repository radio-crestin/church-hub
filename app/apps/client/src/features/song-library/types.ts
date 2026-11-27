/** The curated Church Hub Library (T-177), as the server reports it. */

/** A library song like a submission: same lyrics, or the same title. */
export interface LibraryMatch {
  id: string
  title: string
  sameLyrics: boolean
}

/** A song sent to the library, waiting for a curator. */
export interface LibrarySubmission {
  id: string
  /** Unix ms. */
  submittedAt: number
  title: string
  churchName: string | null
  note: string | null
  slides: Array<{ label: string | null; text: string }>
  matches: LibraryMatch[]
}

/** Who is signed in to curate on this PC, if anyone. */
export interface CuratorStatus {
  signedIn: boolean
  email: string | null
  curator: boolean
}

export type CuratorDecision =
  | { decision: 'approved' }
  | { decision: 'merged'; librarySongId: string }
  | { decision: 'rejected'; reason: string | null }

/** A song source every app is offered: a library Church Hub manages. */
export interface FeaturedSource {
  sourceId: string
  name: string
  categoryName: string
  description: string | null
  homepage: string | null
  license: string | null
}
