import { DatabaseSync } from 'node:sqlite'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * Updating the app must never lose a church's data. Every start runs the
 * start-up migrations again, so this boots a server of its own, saves what a
 * user would have (their own AI key, a screen they took off "always on top",
 * a song background, old-format settings, a program with an old Bible-passage
 * item), restarts it, and checks every piece is still there or converted.
 */

const USER_AI_KEY = 'church-own-key-not-from-the-repo'
const PASSAGES_FLAG = 'merge_bible_passages_into_versete_tineri_v1'

test.describe.configure({ mode: 'serial', timeout: 600_000 })

let server: ExtraServer

test.beforeAll(async () => {
  server = new ExtraServer()
  await server.start()
})

test.afterAll(async () => {
  await server?.dispose()
})

async function restart(): Promise<APIRequestContext> {
  await server.stop()
  await server.start()
  return server.adminRequest()
}

async function saveSetting(
  api: APIRequestContext,
  key: string,
  value: unknown,
) {
  const res = await api.post('/api/settings/app_settings', {
    data: { key, value: JSON.stringify(value) },
  })
  expect(res.ok(), `save ${key}`).toBe(true)
}

test('what a user saved survives a restart', async () => {
  let api = await server.adminRequest()

  await saveSetting(api, 'ai_search_config', {
    provider: 'openai',
    apiKey: USER_AI_KEY,
  })

  const screen = await api.post('/api/screens', {
    data: {
      name: `E2E Upgrade ${Date.now()}`,
      type: 'stage',
      alwaysOnTop: false,
    },
  })
  expect([200, 201]).toContain(screen.status())
  const screenId = (await screen.json()).data.id as number

  const background = { type: 'color', color: '#123456', opacity: 1 }
  const song = await api.post('/api/songs', {
    data: {
      title: `E2E Upgrade Song ${Date.now()}`,
      slides: [{ content: 'Verse one', sortOrder: 0, label: 'V1' }],
    },
  })
  const songId = (await song.json()).data.id as number
  const withBackground = await api.post('/api/songs', {
    data: { id: songId, title: (await song.json()).data.title, background },
  })
  expect(withBackground.ok()).toBe(true)

  // The single-target shape older versions saved.
  await saveSetting(api, 'live_translation_settings', {
    sourceLanguage: 'ro',
    targetLanguage: 'hu',
    voiceName: 'Kore',
    geminiApiKey: 'church-gemini-key',
    outputMode: 'both',
  })

  api = await restart()

  const aiConfig = (
    await (await api.get('/api/settings/app_settings/ai_search_config')).json()
  ).data.value as string
  expect(JSON.parse(aiConfig).apiKey).toBe(USER_AI_KEY)

  const screenAfter = (await (await api.get(`/api/screens/${screenId}`)).json())
    .data as { alwaysOnTop: boolean }
  expect(screenAfter.alwaysOnTop).toBe(false)

  const songAfter = (await (await api.get(`/api/songs/${songId}`)).json()).data
  expect(songAfter.background).toEqual(background)

  const translation = await (
    await api.get('/api/live-translation/settings')
  ).json()
  expect(translation.targets).toHaveLength(1)
  expect(translation.targets[0].targetLanguage).toBe('hu')
  expect(translation.targets[0].voiceName).toBe('Kore')
  expect(translation.geminiApiKey).toBe('church-gemini-key')
  expect(translation.outputMode).toBe('both')
})

test('an old Bible-passage program item is converted, an unreadable one kept', async () => {
  let api = await server.adminRequest()
  const created = await api.post('/api/schedules', {
    data: { title: `E2E Upgrade Program ${Date.now()}` },
  })
  expect([200, 201]).toContain(created.status())
  const scheduleId = (await created.json()).data.id as number

  // Plant what an old version stored, with the server stopped.
  await server.stop()
  const db = new DatabaseSync(server.databasePath)
  try {
    const insert = db.prepare(
      `INSERT INTO schedule_items (schedule_id, item_type, bible_passage_reference, bible_passage_translation, sort_order)
       VALUES (?, 'bible_passage', ?, 'RCCV', ?)`,
    )
    insert.run(scheduleId, 'Ioan 3:16', 0)
    insert.run(scheduleId, 'Nicio Carte 99:99', 1)
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(PASSAGES_FLAG)
  } finally {
    db.close()
  }
  await server.start()
  api = await server.adminRequest()

  const schedule = (
    await (await api.get(`/api/schedules/${scheduleId}`)).json()
  ).data as { items: Record<string, unknown>[] }
  const items = schedule.items
  expect(items).toHaveLength(2)
  const converted = JSON.stringify(items[0])
  expect(converted).not.toContain('bible_passage')
  expect(converted).toContain('3:16')
  // Left exactly as it was: a mangled program would be worse than an old item.
  expect(JSON.stringify(items[1])).toContain('Nicio Carte 99:99')
})
