/**
 * Stands in for `db/fixtures/readFixtureFile.ts` in the browser: a phone seeds
 * no songs and no Bibles (its songs come from the snapshot, the Bible on
 * demand), so the seed migrations find no fixture and skip, as they already
 * do when a fixture is missing.
 */
export function readFixtureFile<T>(_embeddedPath: unknown): T {
  return [] as T
}
