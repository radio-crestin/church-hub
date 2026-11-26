/** A Google account, as an owner ticket proves it (verified by Google). */
export interface OwnerIdentity {
  googleSub: string
  /** Lowercased. */
  email: string
}
