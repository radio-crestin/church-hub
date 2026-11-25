import { DatabaseSync } from 'node:sqlite'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * CH-184: screens kept their own layouts (one per slide kind, whole kinds
 * swapped per OBS scene). On upgrade each screen's become a template of its
 * own and each OBS scene's a template mapped to that scene, so every display
 * draws as before. This turns a fresh install back into the old shape with a
 * customised screen, starts the new version on it and checks nothing is lost.
 */

test.describe.configure({ mode: 'serial', timeout: 300_000 })

const SCENE = 'E2E sala'
const SONG_FONT = 'Times New Roman'
const SCENE_FONT = 'Georgia'

let server: ExtraServer
let api: APIRequestContext
let mainId: number

/** What the old version stored for the Main screen. */
const OLD_SONG = {
  background: { type: 'color', color: '#102030', opacity: 1 },
  clockEnabled: true,
  mainText: {
    constraints: {
      top: { enabled: true, value: 20, unit: '%' },
      bottom: { enabled: true, value: 10, unit: '%' },
      left: { enabled: true, value: 5, unit: '%' },
      right: { enabled: true, value: 5, unit: '%' },
    },
    size: { width: 100, widthUnit: '%', height: 100, heightUnit: '%' },
    style: {
      fontFamily: SONG_FONT,
      maxFontSize: 77,
      autoScale: true,
      color: '#ffeeaa',
      bold: false,
      italic: true,
      underline: false,
      alignment: 'left',
      verticalAlignment: 'top',
      lineHeight: 1.3,
    },
    padding: 0,
    animationIn: { type: 'none', duration: 0, delay: 0, easing: 'linear' },
    animationOut: { type: 'none', duration: 0, delay: 0, easing: 'linear' },
  },
}
const OLD_BIBLE_REFERENCE_COLOR = '#00ff88'
const OLD_NEXT_SLIDE = { enabled: true, labelText: 'Next up:' }
const OLD_BACKGROUND = { type: 'color', color: '#222222', opacity: 1 }
const OLD_CLOCK = { format: '12h', showSeconds: true }

/** Takes the database back to before slide templates, with Main customised. */
function toOldShape(databasePath: string) {
  const db = new DatabaseSync(databasePath)
  try {
    const main = db
      .prepare("SELECT id, template_id FROM screens WHERE type = 'primary'")
      .get() as { id: number; template_id: number }
    mainId = main.id
    const template = db
      .prepare(
        'SELECT layouts, global_settings FROM slide_templates WHERE id = ?',
      )
      .get(main.template_id) as { layouts: string; global_settings: string }
    const bible = JSON.parse(template.layouts).bible
    bible.referenceText.style.color = OLD_BIBLE_REFERENCE_COLOR
    const global = JSON.parse(template.global_settings)
    const oldGlobal = {
      ...global,
      defaultBackground: OLD_BACKGROUND,
      clockConfig: { ...global.clockConfig, ...OLD_CLOCK },
    }

    db.exec(`
      ALTER TABLE screens ADD COLUMN width integer DEFAULT 1920 NOT NULL;
      ALTER TABLE screens ADD COLUMN height integer DEFAULT 1080 NOT NULL;
      ALTER TABLE screens ADD COLUMN global_settings text DEFAULT '{}' NOT NULL;
      CREATE TABLE screen_content_configs (id integer PRIMARY KEY AUTOINCREMENT,
        screen_id integer NOT NULL, content_type text NOT NULL,
        config text DEFAULT '{}' NOT NULL, created_at integer, updated_at integer);
      CREATE TABLE screen_next_slide_configs (id integer PRIMARY KEY AUTOINCREMENT,
        screen_id integer NOT NULL, config text DEFAULT '{}' NOT NULL,
        created_at integer, updated_at integer);
      CREATE TABLE screen_scene_overrides (id integer PRIMARY KEY AUTOINCREMENT,
        screen_id integer NOT NULL, obs_scene_name text NOT NULL,
        content_type text NOT NULL, config text DEFAULT '{}' NOT NULL,
        created_at integer, updated_at integer);
      UPDATE screens SET template_id = NULL;
      DELETE FROM slide_templates WHERE bundled_key IS NULL;
      DELETE FROM app_settings WHERE key = 'move_screen_layouts_into_templates';
    `)
    db.prepare(
      'UPDATE screens SET width = 1600, height = 900, global_settings = ? WHERE id = ?',
    ).run(JSON.stringify(oldGlobal), mainId)
    // Saved: song and bible. Never saved: the first/last song slides.
    const insert = db.prepare(
      'INSERT INTO screen_content_configs (screen_id, content_type, config) VALUES (?, ?, ?)',
    )
    insert.run(mainId, 'song', JSON.stringify(OLD_SONG))
    insert.run(mainId, 'bible', JSON.stringify(bible))
    db.prepare(
      'INSERT INTO screen_next_slide_configs (screen_id, config) VALUES (?, ?)',
    ).run(mainId, JSON.stringify(OLD_NEXT_SLIDE))
    const sceneSong = {
      ...OLD_SONG,
      mainText: {
        ...OLD_SONG.mainText,
        style: { ...OLD_SONG.mainText.style, fontFamily: SCENE_FONT },
      },
    }
    db.prepare(
      'INSERT INTO screen_scene_overrides (screen_id, obs_scene_name, content_type, config) VALUES (?, ?, ?, ?)',
    ).run(mainId, SCENE, 'song', JSON.stringify(sceneSong))
  } finally {
    db.close()
  }
}

test.beforeAll(async () => {
  server = new ExtraServer()
  await server.start()
  await server.stop()
  toOldShape(server.databasePath)
  await server.start()
  api = await server.adminRequest()
})

test.afterAll(async () => {
  await api?.dispose()
  await server?.dispose()
})

test('each screen keeps its layouts, now in a template of its own', async () => {
  expect(server.log).toContain(`Screen ${mainId} (Main) → template`)
  const main = (await (await api.get(`/api/screens/${mainId}`)).json()).data
  expect(main.width).toBe(1600)
  expect(main.height).toBe(900)
  expect(main.followsPresentation).toBe(true)
  expect(main.contentConfigs.song).toMatchObject(OLD_SONG)
  expect(main.contentConfigs.bible.referenceText.style.color).toBe(
    OLD_BIBLE_REFERENCE_COLOR,
  )
  expect(main.nextSlideConfig).toMatchObject(OLD_NEXT_SLIDE)
  expect(main.globalSettings.defaultBackground).toEqual(OLD_BACKGROUND)
  expect(main.globalSettings.clockConfig).toMatchObject(OLD_CLOCK)

  const template = (
    await (await api.get(`/api/slide-templates/${main.templateId}`)).json()
  ).data
  expect(template.name).toBe('Main')
  expect(template.bundledKey).toBeNull()
  expect(template.usage.screens).toEqual([{ id: mainId, name: 'Main' }])

  // The other screens got theirs too.
  const screens = (await (await api.get('/api/screens')).json()).data as {
    templateId: number
  }[]
  expect(new Set(screens.map((s) => s.templateId)).size).toBe(screens.length)
})

test('an OBS scene override becomes a template mapped to the scene', async () => {
  const main = (await (await api.get(`/api/screens/${mainId}`)).json()).data
  const sceneTemplateId = main.sceneTemplates[SCENE]
  expect(sceneTemplateId).toBeTruthy()
  const scene = (
    await (await api.get(`/api/slide-templates/${sceneTemplateId}`)).json()
  ).data
  expect(scene.name).toBe(`Main · ${SCENE}`)
  expect(scene.layouts.song.mainText.style.fontFamily).toBe(SCENE_FONT)
  // The slide kinds the scene did not swap stay the screen's.
  expect(scene.layouts.bible.referenceText.style.color).toBe(
    OLD_BIBLE_REFERENCE_COLOR,
  )
  expect(scene.width).toBe(1600)
})

test('the old per-screen tables and columns are gone', async () => {
  await server.stop()
  const db = new DatabaseSync(server.databasePath)
  try {
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN
          ('screen_content_configs', 'screen_next_slide_configs', 'screen_scene_overrides')`,
      )
      .all()
    expect(tables).toEqual([])
    const columns = db
      .prepare('PRAGMA table_info(screens)')
      .all()
      .map((row) => (row as { name: string }).name)
    expect(columns).not.toContain('width')
    expect(columns).not.toContain('global_settings')
  } finally {
    db.close()
  }
  await server.start()
  api = await server.adminRequest()
})

test('first and last song slides still follow the song layout', async () => {
  const main = (await (await api.get(`/api/screens/${mainId}`)).json()).data
  expect(main.contentConfigs.song_last_slide.mainText.style.fontFamily).toBe(
    SONG_FONT,
  )
  const song = main.contentConfigs.song
  const saved = await api.put(`/api/screens/${mainId}/config/song`, {
    data: {
      config: {
        ...song,
        mainText: {
          ...song.mainText,
          style: { ...song.mainText.style, fontFamily: 'Arial' },
        },
      },
    },
  })
  expect(saved.ok()).toBe(true)
  const after = (await (await api.get(`/api/screens/${mainId}`)).json()).data
  expect(after.contentConfigs.song_last_slide.mainText.style.fontFamily).toBe(
    'Arial',
  )
})

test('the screen draws a song with its migrated design', async ({
  browser,
}) => {
  const song = await api.post('/api/songs', {
    data: {
      title: 'E2E Template Migration',
      slides: [
        { content: 'Prima strofă', sortOrder: 0 },
        { content: 'Cântarea din mijloc', sortOrder: 1 },
        { content: 'Ultima strofă', sortOrder: 2 },
      ],
    },
  })
  expect(song.ok()).toBe(true)
  const songId = (await song.json()).data.id as number
  await api.post('/api/presentation/temporary-song', {
    data: { songId, slideIndex: 1 },
  })

  const context = await browser.newContext({
    baseURL: server.baseURL,
    storageState: await api.storageState(),
    viewport: { width: 1600, height: 900 },
  })
  try {
    const page = await context.newPage()
    await page.goto(`/screen/${mainId}`)
    const lyrics = page
      .locator('[data-style-anchor]', { hasText: 'Cântarea din mijloc' })
      .first()
    await expect(lyrics).toBeVisible({ timeout: 15_000 })
    const style = await lyrics.evaluate((el) => {
      const computed = getComputedStyle(el)
      return { font: computed.fontFamily, color: computed.color }
    })
    expect(style.font).toContain('Arial')
    expect(style.color).toBe('rgb(255, 238, 170)')
  } finally {
    await context.close()
  }
})
