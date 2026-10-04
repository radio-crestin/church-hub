/**
 * Pulls the app version out of `church-hub-backup-v0.1.85-<iso>.db`. Returns
 * null for names that don't carry one (hand-renamed files, older layouts).
 *
 * The version is one run of non-dash characters starting with a digit; a
 * single `[^-]*` keeps the match linear (no nested repetition to backtrack).
 */
export function parseAppVersion(fileName: string): string | null {
  const match = fileName.match(/-v(\d[^-]*)-\d{4}-/)
  return match?.[1] ?? null
}
