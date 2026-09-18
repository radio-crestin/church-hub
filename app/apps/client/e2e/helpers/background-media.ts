import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
} from '@playwright/test'

/**
 * Shared bits of the background media specs (screen backgrounds, song
 * backgrounds, the gallery): fixtures, the upload API, UI labels in either
 * shipped language, and the background editor's controls.
 */

const helpersDir = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(helpersDir, '..', 'fixtures')
const LOCALES_DIR = path.join(helpersDir, '..', '..', 'src', 'i18n', 'locales')
const LANGUAGES = ['en', 'ro'] as const
type Language = (typeof LANGUAGES)[number]

export const MEDIA_API = '/api/media/backgrounds'

/** The layouts a song is drawn with on a screen. */
export const SONG_CONTENT_TYPES = [
  'song',
  'song_first_slide',
  'song_last_slide',
]

// A 3 s, 160×90 VP8 loop. Playwright's Chromium has no H.264 decoder, so the
// video that must actually play is WebM.
export const WEBM_FIXTURE = path.join(FIXTURES_DIR, 'background-loop.webm')

/** A 1×1 baseline JPEG. */
export const JPEG_FIXTURE = path.join(FIXTURES_DIR, 'background-still.jpg')

/** A 1×1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

export type BackgroundType =
  | 'inherit'
  | 'transparent'
  | 'color'
  | 'image'
  | 'video'

export interface BackgroundMedia {
  id: string
  kind: 'image' | 'video'
  mimeType: string
  size: number
  url: string
  createdAt: number
}

export async function uploadMedia(
  request: APIRequestContext,
  body: Buffer,
  mimeType: string,
  name: string,
): Promise<BackgroundMedia> {
  const res = await request.post(
    `${MEDIA_API}?name=${encodeURIComponent(name)}`,
    { headers: { 'Content-Type': mimeType }, data: body },
  )
  expect(res.status()).toBe(201)
  return (await res.json()).data as BackgroundMedia
}

export async function listMedia(
  request: APIRequestContext,
): Promise<BackgroundMedia[]> {
  const res = await request.get(MEDIA_API)
  expect(res.status()).toBe(200)
  return (await res.json()).data as BackgroundMedia[]
}

export async function listMediaIds(
  request: APIRequestContext,
): Promise<string[]> {
  return (await listMedia(request)).map((m) => m.id)
}

/**
 * Deletes every upload not in `keep` — including one whose test failed before
 * noting its id.
 */
export async function deleteMediaExcept(
  request: APIRequestContext,
  keep: ReadonlySet<string>,
): Promise<void> {
  for (const id of await listMediaIds(request)) {
    if (!keep.has(id)) await request.delete(`${MEDIA_API}/${id}`)
  }
}

/** A UI string in each shipped language. */
function translations(
  namespace: string,
  key: string | ((language: Language) => string),
): Record<Language, string> {
  const entries = LANGUAGES.map((language) => {
    const file = path.join(LOCALES_DIR, language, `${namespace}.json`)
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    const fullKey = typeof key === 'function' ? key(language) : key
    const text = fullKey
      .split('.')
      .reduce((node, part) => node?.[part], json) as unknown
    if (typeof text !== 'string') {
      throw new Error(`Missing ${language} translation ${namespace}:${fullKey}`)
    }
    return [language, text] as const
  })
  return Object.fromEntries(entries) as Record<Language, string>
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches a UI label exactly, in either shipped language: the seeded test
 * database stores `language=ro`, while a fresh one starts in English.
 */
export function label(namespace: string, key: string): RegExp {
  const texts = Object.values(translations(namespace, key)).map(escapeRegExp)
  return new RegExp(`^(${texts.join('|')})$`)
}

/**
 * Matches an interpolated message exactly, in either shipped language.
 * `key` may depend on the language (plural forms); so may the values.
 */
export function message(
  namespace: string,
  key: string | ((language: Language) => string),
  values: (language: Language) => Record<string, string | number>,
): RegExp {
  const texts = Object.entries(translations(namespace, key)).map(
    ([language, template]) => {
      const vars = values(language as Language)
      const text = template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        String(vars[name]),
      )
      return escapeRegExp(text)
    },
  )
  return new RegExp(`^(${texts.join('|')})$`)
}

/** The label of a background type in one language (for interpolation). */
export function backgroundTypeLabel(
  type: BackgroundType,
  language: Language,
): string {
  return translations('presentation', `screens.background.types.${type}`)[
    language
  ]
}

/** Sets the same background on the three configs a screen draws songs with. */
export async function setScreenSongBackground(
  request: APIRequestContext,
  screenId: number,
  background: Record<string, unknown>,
): Promise<void> {
  const { data: screen } = await (
    await request.get(`/api/screens/${screenId}`)
  ).json()
  for (const contentType of SONG_CONTENT_TYPES) {
    const res = await request.put(
      `/api/screens/${screenId}/config/${contentType}`,
      {
        data: {
          config: { ...screen.contentConfigs[contentType], background },
        },
      },
    )
    expect(res.status()).toBe(200)
  }
}

/** Picks a type in the background editor's type select. */
export async function chooseBackgroundType(
  page: Page,
  type: BackgroundType,
): Promise<void> {
  await page.getByTestId('background-type-select').click()
  await page
    .locator(
      `[data-testid="background-type-select-option"][data-value="${type}"] button`,
    )
    .first()
    .click()
  await expect(page.getByTestId('background-type-select')).toHaveText(
    label('presentation', `screens.background.types.${type}`),
  )
  if (type === 'image' || type === 'video') {
    await expect(page.getByTestId('background-media-picker')).toBeVisible()
  }
}

/** The ids of the picker tiles currently selected. */
function selectedMediaIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="background-media-item"][data-selected="true"]')
    .evaluateAll((tiles) =>
      tiles.map((tile) => tile.getAttribute('data-media-id') ?? ''),
    )
}

/**
 * Uploads through the picker's hidden file input and returns the new file's
 * media entry. The id is read from the tile the picker selects on arrival,
 * not from the response body (Chromium may evict it from the inspector cache).
 */
export async function uploadThroughPicker(
  page: Page,
  request: APIRequestContext,
  files: Parameters<Locator['setInputFiles']>[0],
): Promise<BackgroundMedia> {
  const before = new Set(await listMediaIds(request))
  const upload = page.waitForResponse(
    (res) => res.url().includes(MEDIA_API) && res.request().method() === 'POST',
  )
  await page.getByTestId('background-media-upload-input').setInputFiles(files)
  expect((await upload).status()).toBe(201)

  // The background may already use an earlier upload: wait until the new file
  // is the one (and only one) selected.
  let id = ''
  await expect
    .poll(
      async () => {
        const ids = await selectedMediaIds(page)
        id = ids[0] ?? ''
        return ids.length === 1 && !before.has(id)
      },
      { message: 'the new upload is the only selected tile' },
    )
    .toBe(true)

  const media = (await listMedia(request)).find((item) => item.id === id)
  expect(media).toBeDefined()
  return media as BackgroundMedia
}

/** Matches the inline style of an image background layer showing `url`. */
export function backgroundImageStyle(url: string): RegExp {
  return new RegExp(`background-image: url\\(".*${escapeRegExp(url)}"\\)`)
}
