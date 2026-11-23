/**
 * Runs the bench page headless in a persistent profile (OPFS on disk, as on a
 * device) and prints each run's results.
 * usage: runBench.ts <page-url> <chromium|webkit> <profile-dir> <snapshot>:<mode>...
 *   snapshot "" = reopen (an app start after a sync)
 */
import { chromium, webkit } from 'playwright'

const [pageUrl, browserName, profileDir, ...runs] = process.argv.slice(2)
if (!pageUrl || !profileDir || runs.length === 0) {
  throw new Error(
    'usage: runBench.ts <page-url> <chromium|webkit> <profile-dir> <snapshot>:<mode>...',
  )
}
const browserType = browserName === 'webkit' ? webkit : chromium
const context = await browserType.launchPersistentContext(profileDir, {
  headless: true,
})
const page = context.pages()[0] ?? (await context.newPage())
page.on('pageerror', (error) => console.error(`pageerror: ${error.message}`))

for (const run of runs) {
  const [snapshot, mode = 'memory-import'] = run.split(':')
  const url = new URL(pageUrl)
  url.searchParams.set('snapshot', snapshot ?? '')
  url.searchParams.set('mode', mode)
  if (!snapshot) url.searchParams.set('wipe', '0')
  await page.goto(url.href)
  const results = await page.waitForFunction(
    () => (window as { benchResults?: unknown }).benchResults,
    undefined,
    { timeout: 20 * 60_000, polling: 1000 },
  )
  console.log(JSON.stringify({ run, results: await results.jsonValue() }))
}
await context.close()
