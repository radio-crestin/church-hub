// biome-ignore-all lint/suspicious/noConsole: a command-line script reports on stdout
/**
 * Runs the bench page in a Playwright browser and checks what it proves:
 *   bun spikes/cloud-sync/scripts/runInBrowser.ts <page-url> <chromium|webkit> <snapshot|''> [mode] [results-dir]
 * A persistent profile, as on a phone: an incognito context keeps OPFS in
 * memory, where every write costs 25+ ms. Exits 1 when the bench fails, or
 * when an edit isn't found by search or isn't queued for sync.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, webkit } from '@playwright/test'

const [pageUrl, engine = 'chromium', snapshot = '', mode = '', resultsDir] =
  process.argv.slice(2)
if (!pageUrl)
  throw new Error(
    'usage: runInBrowser.ts <page-url> <engine> <snapshot> [mode] [results-dir]',
  )

const profile = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'profile-'))
const context = await (engine === 'webkit'
  ? webkit
  : chromium
).launchPersistentContext(profile)
const page = await context.newPage()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

type Results = Record<string, unknown> & {
  error?: string
  editFoundBySearch?: boolean
  editQueuedForSync?: boolean
}
async function runOnce(query: string): Promise<Results> {
  await page.goto(`${pageUrl}?${query}`)
  await page.waitForFunction(() => 'benchResults' in window, null, {
    timeout: 30 * 60_000,
    polling: 1000,
  })
  return page.evaluate(
    () => (window as unknown as { benchResults: Results }).benchResults,
  )
}

const first = await runOnce(
  `snapshot=${snapshot}${mode ? `&mode=${mode}` : ''}`,
)
// The app's next start on the same device: OPFS kept the db, no download.
const reopen = snapshot ? await runOnce('snapshot=&wipe=0') : null
await context.close()
rmSync(profile, { recursive: true, force: true })

const ms = (value: unknown) =>
  typeof value === 'object' && value && 'ms' in value
    ? (value as { ms: number }).ms
    : value
const summary = (r: Results) => ({
  mode: r.mode,
  ftsRowidPreview: r.ftsRowidPreview,
  error: r.error,
  songs: r.songsInDb,
  wasmInit: r.wasmInit,
  migrations: ms(r.migrations),
  download: ms(r.download),
  gunzipParse: ms(r.gunzipParse),
  syncApply: r.syncApply,
  ftsRebuild: r.ftsRebuild,
  importDb: ms(r.importDb),
  commit: r.commitCost,
  list: ms(r.listFirstPage),
  search: r.search && {
    median: (r.search as { medianMs: number }).medianMs,
    max: (r.search as { maxMs: number }).maxMs,
  },
  songEdit: r.songEdit,
  reindexOne: r.reindexOne,
  editFound: r.editFoundBySearch,
  queued: r.editQueuedForSync,
  dbMB: typeof r.dbBytes === 'number' ? +(r.dbBytes / 1e6).toFixed(1) : null,
  wasmHeapMB:
    typeof r.wasmHeapBytes === 'number'
      ? +(r.wasmHeapBytes / 1e6).toFixed(0)
      : null,
  total: r.totalMs,
})
console.log(
  JSON.stringify({
    engine,
    snapshot,
    first: summary(first),
    reopen: reopen && summary(reopen),
  }),
)
if (resultsDir) {
  await Bun.write(
    join(
      resultsDir,
      `${engine}-${snapshot || 'reopen'}-${mode || 'default'}-${Date.now()}.json`,
    ),
    JSON.stringify({ first, reopen }, null, 2),
  )
}

const failures = [first, reopen].filter(
  (r): r is Results =>
    !!r &&
    (!!r.error || r.editFoundBySearch !== true || r.editQueuedForSync !== true),
)
for (const failure of failures)
  console.log(
    `FAIL ${failure.mode}: ${failure.error ?? 'edit not found or not queued'}`,
  )
process.exit(failures.length ? 1 : 0)
