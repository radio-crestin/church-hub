#!/usr/bin/env node
/**
 * Retakes the README screenshots (docs/screenshots/*.png) from a running test
 * server on a fresh database: the bundled song library and Bibles, plus a
 * small demo program, Marcaje and a presented song seeded here. No church data.
 *
 *   # a server on a fresh DB, e.g. on port 3199
 *   NODE_ENV=production CLIENT_DIST_PATH=apps/client/dist \
 *     DATABASE_PATH=<scratch>/app.db PORT=3199 bun run apps/server/src/index.ts
 *   # then, in app/apps/client
 *   SCREENSHOT_PORT=3199 node scripts/readme-screenshots.ts [name ...]
 *
 * The client must be built for that port (VITE_API_PORT / VITE_SERVER_PORT).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  type BrowserContext,
  chromium,
  type Page,
} from '@playwright/test'

const PORT = process.env.SCREENSHOT_PORT ?? '3199'
const BASE_URL = `http://localhost:${PORT}`
const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/screenshots',
)
const VIEWPORT = { width: 1920, height: 1080 }

const DEMO_SONGS = [
  'Cât de mare eşti Isus',
  'Lauda pe Domnul o suflete',
  'Doamne sfinte Te marim',
  'Mare e Domnul',
  'Isus e Domnul',
]

interface Shot {
  name: string
  take: (page: Page, demo: Demo) => Promise<void>
}

interface Demo {
  songIds: number[]
  scheduleId: number
}

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>) {
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()}`)
  return ((await res.json()) as { data: T }).data
}

async function signIn(context: BrowserContext) {
  const users = await json<{ id: number; isSuperAdmin: boolean }[]>(
    await context.request.get('/api/auth/local-users'),
  )
  const admin = users.find((u) => u.isSuperAdmin)
  if (!admin) throw new Error('no super admin: use a fresh database')
  await json(
    await context.request.post('/api/auth/login', {
      data: { userId: admin.id },
    }),
  )
}

async function findSong(request: APIRequestContext, title: string) {
  const hits = await json<{ id: number; title: string }[]>(
    await request.get(`/api/songs/search?q=${encodeURIComponent(title)}`),
  )
  if (!hits[0]) throw new Error(`demo song not found: ${title}`)
  return hits[0].id
}

const DEMO_KEYS = ['Do major', 'Sol major', 'Re major', 'La minor', 'Fa major']

async function present(request: APIRequestContext, songId: number) {
  await json(
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 1 },
    }),
  )
}

/** A real edit for Song history: the comma-below letters Romanian uses. */
async function fixCedillas(request: APIRequestContext, songId: number) {
  const song = await json<{
    title: string
    slides: { content: string; sortOrder: number; label: string | null }[]
  }>(await request.get(`/api/songs/${songId}`))
  const fix = (text: string) =>
    text.replaceAll('ş', 'ș').replaceAll('ţ', 'ț').replaceAll('Ţ', 'Ț')
  await json(
    await request.post('/api/songs', {
      data: {
        id: songId,
        title: fix(song.title),
        slides: song.slides.map(({ content, sortOrder, label }) => ({
          content: fix(content),
          sortOrder,
          label,
        })),
      },
    }),
  )
}

async function seedDemo(request: APIRequestContext): Promise<Demo> {
  const songIds: number[] = []
  for (const title of DEMO_SONGS) songIds.push(await findSong(request, title))
  // A key on each song (Song Keys, program rows); the edit also starts each
  // song's history.
  for (const [i, id] of songIds.entries()) {
    const song = await json<{ title: string }>(
      await request.get(`/api/songs/${id}`),
    )
    await json(
      await request.post('/api/songs', {
        data: { id, title: song.title, keyLine: DEMO_KEYS[i] },
      }),
    )
  }

  await fixCedillas(request, songIds[0])

  const schedule = await json<{ id: number }>(
    await request.post('/api/schedules', {
      data: { title: 'Duminică dimineața' },
    }),
  )
  const translations = await json<{ id: number }[]>(
    await request.get('/api/bible/translations'),
  )
  const passage = {
    translationId: translations[0].id,
    bookCode: 'JHN',
    bookName: 'Ioan',
    startChapter: 3,
    startVerse: 16,
    endChapter: 3,
    endVerse: 18,
  }
  const items = [
    { songId: songIds[0] },
    { songId: songIds[1] },
    { biblePassage: passage },
    { songId: songIds[2] },
    { songId: songIds[3] },
  ]
  for (const data of items)
    await json(
      await request.post(`/api/schedules/${schedule.id}/items`, { data }),
    )
  for (const songId of songIds.slice(0, 4))
    await json(await request.post('/api/song-bookmarks', { data: { songId } }))

  // Song Keys lists what was presented.
  for (const songId of songIds.slice(1)) await present(request, songId)
  await json(await request.post('/api/presentation/stop'))
  return { songIds, scheduleId: schedule.id }
}

async function open(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
}

async function openSongAction(page: Page, songId: number, action: string) {
  await open(page, `/songs/${songId}`)
  await page.getByTestId('song-actions-menu').click()
  await page.getByTestId(action).click()
  await page.waitForTimeout(1000)
}

const SHOTS: Shot[] = [
  // Before anything is live: /songs opens the live song when there is one.
  { name: 'songs-list', take: (p) => open(p, '/songs') },
  {
    name: 'control-room',
    take: async (p, d) => {
      await present(p.request, d.songIds[0])
      await open(p, '/present')
    },
  },
  { name: 'songs-view', take: (p, d) => open(p, `/songs/${d.songIds[0]}`) },
  {
    name: 'song-editor',
    take: (p, d) => open(p, `/songs/${d.songIds[0]}?edit=slides`),
  },
  {
    name: 'song-history',
    take: (p, d) => openSongAction(p, d.songIds[0], 'song-history'),
  },
  { name: 'schedules', take: (p) => open(p, '/schedules') },
  {
    name: 'schedule-song',
    take: (p, d) => open(p, `/schedules/${d.scheduleId}`),
  },
  { name: 'gallery', take: (p) => open(p, '/gallery') },
  { name: 'livestream', take: (p) => open(p, '/livestream') },
  {
    name: 'music',
    take: async (p) => {
      await open(p, '/music')
      await p.getByText('Sample Hymns').first().click()
      await p.waitForTimeout(1500)
    },
  },
  { name: 'song-key', take: (p) => open(p, '/song-key') },
  {
    name: 'screen-editor',
    take: async (p) => {
      await open(p, '/settings/screens')
      await p.getByRole('button', { name: 'Edit layout' }).first().click()
      await p.waitForTimeout(2500)
    },
  },
  { name: 'control-room-settings', take: (p) => open(p, '/settings/screens') },
  { name: 'backup', take: (p) => open(p, '/settings/backup') },
  { name: 'settings', take: (p) => open(p, '/settings/users') },
  // Last: presenting a verse takes the song off the screens.
  {
    name: 'bible',
    take: async (p) => {
      await open(p, '/bible')
      const search = p.getByPlaceholder(/search/i).first()
      await search.fill('Ioan 3:16')
      await p.locator('button.ring-indigo-500').waitFor()
      await search.press('Enter')
      await p.waitForTimeout(2000)
    },
  },
]

async function main() {
  const only = process.argv.slice(2)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORT,
    colorScheme: 'dark',
  })
  await signIn(context)
  const demo = await seedDemo(context.request)
  // The README is in English; the saved language would win over localStorage.
  await context.route('**/api/settings/app_settings/language', (route) =>
    route.fulfill({ json: { data: { key: 'language', value: 'en' } } }),
  )
  const page = await context.newPage()
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.name)) continue
    await shot.take(page, demo)
    await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`) })
    process.stdout.write(`✓ ${shot.name}\n`)
  }
  await browser.close()
}

await main()
