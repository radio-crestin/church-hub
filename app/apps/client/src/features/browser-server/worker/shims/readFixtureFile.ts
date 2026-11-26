/**
 * `db/fixtures/readFixtureFile.ts` in the browser build. Each embedded seed
 * fixture is a gzipped asset (browserServerBuild.ts) that registers its URL
 * here; the worker downloads the ones a database is seeded from before the
 * migrations run (loadFixtures). A fixture not loaded reads as none, so its
 * seed is skipped, as the server's seeds already do without one.
 */
const urls = new Map<string, string>()
const loaded = new Map<string, unknown>()

/** Called by each fixture's module: its file name → its asset URL. */
export function registerFixture(name: string, url: string): string {
  urls.set(name, url)
  return url
}

async function download(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Fixture ${url}: ${response.status}`)
  }
  const body = url.endsWith('.gz')
    ? response.body.pipeThrough(new DecompressionStream('gzip'))
    : response.body
  return new Response(body).json()
}

/** Downloads the named fixtures (e.g. `default-songs.json`) for the seeds. */
export async function loadFixtures(names: string[]): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      const url = urls.get(name)
      if (!url) throw new Error(`No fixture named ${name}`)
      loaded.set(url, await download(url))
    }),
  )
}

/** Lets go of the fixtures once the seeds have read them. */
export function unloadFixtures(): void {
  loaded.clear()
}

export function readFixtureFile<T>(embeddedPath: unknown): T {
  return (loaded.get(embeddedPath as string) ?? []) as T
}
