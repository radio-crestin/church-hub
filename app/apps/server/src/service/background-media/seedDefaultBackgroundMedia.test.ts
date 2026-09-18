import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BACKGROUND_MEDIA_ID_REGEX,
  DEFAULT_BACKGROUND_MEDIA,
  DEFAULT_BACKGROUND_MEDIA_MARKER_KEY,
} from './constants'
import { deleteBackgroundMedia } from './deleteBackgroundMedia'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { getDefaultBackgroundMediaSourceDir } from './getDefaultBackgroundMediaSourceDir'
import { listBackgroundMedia } from './listBackgroundMedia'
import type { Database } from 'bun:sqlite'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test'
import { createMigratedTestDatabase } from '../../__tests__/helpers/createMigratedTestDatabase'

type SeedModule = typeof import('./seedDefaultBackgroundMedia')

const DEFAULT_IDS = DEFAULT_BACKGROUND_MEDIA.map(({ id }) => id)

let sqlite: Database
let seedDefaultBackgroundMedia: SeedModule['seedDefaultBackgroundMedia']
let tempDir: string
let sourceDir: string
let previousDatabasePath: string | undefined

/** Stand-in bundled files: distinct bytes per default, dated in the past. */
function writeBundledDefaults(): void {
  mkdirSync(sourceDir, { recursive: true })
  const past = new Date('2020-01-01T00:00:00Z')
  for (const { fileName } of DEFAULT_BACKGROUND_MEDIA) {
    const path = join(sourceDir, fileName)
    writeFileSync(path, `bundled ${fileName}`)
    utimesSync(path, past, past)
  }
}

function storedBytes(id: string): Promise<string> {
  return Bun.file(join(getBackgroundMediaDir(), id)).text()
}

function marker(): string | null {
  return (
    sqlite
      .query<{ value: string }, [string]>(
        'SELECT value FROM app_settings WHERE key = ?',
      )
      .get(DEFAULT_BACKGROUND_MEDIA_MARKER_KEY)?.value ?? null
  )
}

beforeAll(async () => {
  ;({ sqlite } = await createMigratedTestDatabase())
  ;({ seedDefaultBackgroundMedia } = await import(
    './seedDefaultBackgroundMedia'
  ))
})

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'default-background-media-'))
  sourceDir = join(tempDir, 'resources', 'default-backgrounds')
  previousDatabasePath = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = join(tempDir, 'data', 'app.db')
  sqlite.run('DELETE FROM app_settings WHERE key = ?', [
    DEFAULT_BACKGROUND_MEDIA_MARKER_KEY,
  ])
})

afterEach(() => {
  if (previousDatabasePath === undefined) {
    delete process.env.DATABASE_PATH
  } else {
    process.env.DATABASE_PATH = previousDatabasePath
  }
  rmSync(tempDir, { recursive: true, force: true })
})

describe('default background media', () => {
  test('every default has a valid media id and ships in tauri/resources', () => {
    expect(DEFAULT_BACKGROUND_MEDIA.length).toBeGreaterThan(0)
    for (const { fileName, id } of DEFAULT_BACKGROUND_MEDIA) {
      expect(id).toMatch(BACKGROUND_MEDIA_ID_REGEX)
      expect(
        existsSync(join(getDefaultBackgroundMediaSourceDir(), fileName)),
      ).toBe(true)
    }
    expect(new Set(DEFAULT_IDS).size).toBe(DEFAULT_IDS.length)
  })
})

describe('seedDefaultBackgroundMedia', () => {
  test('copies each default into the gallery under its fixed id and sets the marker', async () => {
    writeBundledDefaults()

    await seedDefaultBackgroundMedia(sourceDir)

    const media = await listBackgroundMedia()
    expect(media.map((item) => item.id).sort()).toEqual([...DEFAULT_IDS].sort())
    for (const { fileName, id } of DEFAULT_BACKGROUND_MEDIA) {
      const item = media.find((entry) => entry.id === id)
      expect(item).toMatchObject({
        kind: 'video',
        mimeType: 'video/mp4',
        size: `bundled ${fileName}`.length,
      })
      // Dated when it was added, not when the bundled file was built.
      expect(item?.createdAt).toBeGreaterThan(Date.now() - 60_000)
      expect(await storedBytes(id)).toBe(`bundled ${fileName}`)
    }
    // No temp file left behind.
    expect(readdirSync(getBackgroundMediaDir()).sort()).toEqual(
      [...DEFAULT_IDS].sort(),
    )
    expect(JSON.parse(marker() ?? 'null')).toEqual(DEFAULT_IDS)
  })

  test('runs once: a default the user deleted is not added back', async () => {
    writeBundledDefaults()
    await seedDefaultBackgroundMedia(sourceDir)
    for (const id of DEFAULT_IDS) {
      await deleteBackgroundMedia(id)
    }

    await seedDefaultBackgroundMedia(sourceDir)

    expect(await listBackgroundMedia()).toEqual([])
    expect(marker()).not.toBeNull()
  })

  test('keeps a file already stored under a default id', async () => {
    writeBundledDefaults()
    mkdirSync(getBackgroundMediaDir(), { recursive: true })
    for (const id of DEFAULT_IDS) {
      writeFileSync(join(getBackgroundMediaDir(), id), 'already here')
    }

    await seedDefaultBackgroundMedia(sourceDir)

    for (const id of DEFAULT_IDS) {
      expect(await storedBytes(id)).toBe('already here')
    }
    expect(marker()).not.toBeNull()
  })

  test('a missing bundled file adds nothing and sets no marker, so the next start retries', async () => {
    await seedDefaultBackgroundMedia(sourceDir)

    expect(await listBackgroundMedia()).toEqual([])
    expect(marker()).toBeNull()

    writeBundledDefaults()
    await seedDefaultBackgroundMedia(sourceDir)

    expect((await listBackgroundMedia()).map((item) => item.id).sort()).toEqual(
      [...DEFAULT_IDS].sort(),
    )
    expect(marker()).not.toBeNull()
  })
})
