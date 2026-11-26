import { gunzipSync } from 'node:zlib'
import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'
import {
  SECRET_NAME,
  SECRET_VALUE,
} from '../../server/src/db/fixtures/secret-patterns'
import { isSecretSettingKey } from '../../server/src/service/settings/isSecretSettingKey'
import {
  SYNCED_SETTING_KEYS,
  SYNCED_TABLES,
} from '../../server/src/service/sync/syncedTables'

/**
 * Cloud sync carries every table (T-173): tags, song and Bible bookmarks and
 * their notes, playlists, church-wide settings, users and roles travel like
 * songs, each change with the version it was made on and who made it. The
 * sync service checks each change against its author: a phone does what its
 * user may, and a change made on the PC by someone the church no longer
 * allows is put back and shown with the permission it needed.
 */

interface Ref {
  seq: number
  key: string
}
interface Change {
  type: string
  uuid: string
  op: 'upsert' | 'delete'
  version: number
  author: string | null
  data?: Record<string, unknown>
}

const s3 = new FakeS3()
const service = new SyncService()
const now = () => Math.floor(Date.now() / 1000)

async function readGzip<T>(url: string): Promise<T> {
  const response = await fetch(url)
  expect(response.status).toBe(200)
  return JSON.parse(
    gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'),
  ) as T
}

/** Every change published since the church started, oldest first. */
async function published(readUrl: string): Promise<Change[]> {
  const head = (await (await fetch(`${readUrl}/head.json`)).json()) as {
    segments: Ref[]
  }
  const changes: Change[] = []
  for (const ref of head.segments) {
    changes.push(
      ...(await readGzip<{ changes: Change[] }>(`${readUrl}/${ref.key}`))
        .changes,
    )
  }
  return changes
}

/** Whether a published row holds `text` (a delete holds nothing). */
function mentions(change: Change, text: string | number): boolean {
  return JSON.stringify(change.data ?? {}).includes(String(text))
}

/** The latest published change of a row. */
async function latest(readUrl: string, type: string, uuid: string) {
  return (await published(readUrl))
    .filter((change) => change.type === type && change.uuid === uuid)
    .at(-1) as Change
}

/** Runs sync cycles until `check` holds. */
async function syncUntil(
  request: APIRequestContext,
  check: () => Promise<boolean>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await request.post('/api/sync/now')
        return check()
      },
      { timeout: 30_000, intervals: [300, 500, 1000] },
    )
    .toBe(true)
}

async function phoneWrite(churchId: string, token: string, changes: unknown) {
  const response = await fetch(
    `${service.url}/sync/churches/${churchId}/changes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ changes }),
    },
  )
  return { status: response.status, body: await response.json() }
}

/** A user of this PC with a phone of their own on the sync service. */
async function userWithPhone(
  request: APIRequestContext,
  name: string,
  permissions: string[],
) {
  const created = await (
    await request.post('/api/users', { data: { name, permissions } })
  ).json()
  const id = created.data.user.id as number
  const minted = await request.post('/api/sync/cloud/devices', {
    data: { userId: id, name: `${name} phone` },
  })
  expect(minted.status()).toBe(201)
  return {
    id,
    loginToken: created.data.token as string,
    phone: (await minted.json()).data.token as string,
  }
}

async function tagName(request: APIRequestContext, id: number) {
  const tags = (await (await request.get('/api/song-tags')).json()).data as {
    id: number
    name: string
  }[]
  return tags.find((tag) => tag.id === id)?.name
}

test.describe
  .serial('Cloud sync: every table', () => {
    test.setTimeout(120_000)

    let churchId = ''
    let readUrl = ''
    let tagId = 0
    let tagUuid = ''
    let adminUuid = ''

    test.beforeAll(async ({ request }) => {
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, { SYNC_COMPACT_AFTER: '100000' })
      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      ;({ churchId, readUrl } = (await connected.json()).data)
    })

    test.afterAll(async ({ request }) => {
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await s3.stop()
    })

    test('the first upload carries the users and roles, never a secret', async ({
      request,
    }) => {
      await syncUntil(request, async () =>
        (await published(readUrl)).some((change) => change.type === 'user'),
      )
      const changes = await published(readUrl)
      expect(changes.some((change) => change.type === 'role')).toBe(true)
      const users = changes.filter(
        (change) => change.type === 'user' && change.op === 'upsert',
      )
      for (const user of users) {
        expect(Object.keys(user.data ?? {})).not.toEqual(
          expect.arrayContaining(['token']),
        )
        expect(JSON.stringify(user.data)).not.toMatch(/usr_|argon2/)
      }
      adminUuid = users.find((user) => user.data?.isSuperAdmin === 1)
        ?.uuid as string
      expect(adminUuid).toBeTruthy()
    })

    test('no secret is ever synced: not a secret setting, table or value', async ({
      request,
    }) => {
      // What is synced is named: nothing holding a secret is on the lists.
      for (const key of SYNCED_SETTING_KEYS) {
        expect(key).not.toMatch(SECRET_NAME)
        expect(isSecretSettingKey(key), key).toBe(false)
      }
      for (const { table } of SYNCED_TABLES) {
        expect(table).not.toMatch(/secret|token|session|oauth|credential/i)
      }
      const holdsSecret = ({ key, value }: { key: string; value: string }) =>
        SECRET_NAME.test(key) ||
        /"[^"]*(api_?key|secret|token|password|credential)[^"]*"\s*:/i.test(
          value,
        )
      const all = (
        await (await request.get('/api/settings/app_settings')).json()
      ).data as { key: string; value: string }[]
      for (const setting of all.filter(holdsSecret)) {
        expect(SYNCED_SETTING_KEYS as readonly string[]).not.toContain(
          setting.key,
        )
      }

      // A key saved in each kind of place never reaches the church.
      const key = `sk-${'e2e0'.repeat(6)}`
      expect(key).toMatch(SECRET_VALUE)
      const aiConfig = all.find((setting) => setting.key === 'ai_search_config')
      const save = (settingKey: string, value: string) =>
        request.post('/api/settings/app_settings', {
          data: { key: settingKey, value },
        })
      await save('ai_search_config', JSON.stringify({ apiKey: key }))
      await save('e2e_api_key', key)
      const stamp = Date.now()
      await save('search_synonyms', `[["secret${stamp}","test"]]`)
      try {
        await syncUntil(request, async () =>
          (await published(readUrl)).some((change) =>
            mentions(change, `secret${stamp}`),
          ),
        )
        const changes = await published(readUrl)
        expect(JSON.stringify(changes)).not.toMatch(SECRET_VALUE)
        for (const change of changes.filter((c) => c.type === 'setting')) {
          expect(SYNCED_SETTING_KEYS as readonly string[]).toContain(
            change.uuid,
          )
        }
      } finally {
        if (aiConfig) await save('ai_search_config', aiConfig.value)
        else await request.delete('/api/settings/app_settings/ai_search_config')
        await request.delete('/api/settings/app_settings/e2e_api_key')
      }
    })

    test('every table’s edits travel, each with who made it; a device’s own settings stay', async ({
      request,
    }) => {
      const stamp = Date.now()
      const song = (
        await (
          await request.post('/api/songs', {
            data: {
              title: `E2E Every table ${stamp}`,
              slides: [{ content: 'one', sortOrder: 0 }],
            },
          })
        ).json()
      ).data
      tagId = (
        await (
          await request.post('/api/song-tags', {
            data: { name: `E2E tag ${stamp}` },
          })
        ).json()
      ).data.id
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })
      await request.post('/api/song-bookmark-notes', {
        data: { content: `E2E song note ${stamp}` },
      })
      const verse = (
        await (await request.get('/api/bible/search?q=Ioan%203:16')).json()
      ).data.results[0]
      await request.post('/api/bible-bookmarks', {
        data: { verseId: verse.id },
      })
      await request.post('/api/bible-bookmark-notes', {
        data: { content: `E2E Bible note ${stamp}` },
      })
      const playlist = await request.post('/api/music/playlists', {
        data: { name: `E2E playlist ${stamp}` },
      })
      const playlistId = (await playlist.json()).data.id as number
      await request.post('/api/settings/app_settings', {
        data: { key: 'search_synonyms', value: `[["e2e${stamp}","test"]]` },
      })
      // Theme is this device's own choice.
      await request.post('/api/settings/app_settings', {
        data: { key: 'theme', value: 'dark' },
      })

      const wanted = [
        'song_tag',
        'song_bookmark',
        'song_bookmark_note',
        'bible_bookmark_note',
        'music_playlist',
        'setting',
      ]
      // A Bible bookmark is named by its verse, whichever translation.
      const isOurVerse = (change: Change) =>
        change.type === 'bible_bookmark' &&
        change.author === adminUuid &&
        change.data?.chapter === 3 &&
        change.data?.verse === 16
      await syncUntil(request, async () => {
        const changes = await published(readUrl)
        return (
          changes.some(isOurVerse) &&
          wanted.every((type) =>
            changes.some(
              (change) => change.type === type && mentions(change, stamp),
            ),
          )
        )
      })

      const changes = await published(readUrl)
      const ours = changes.filter((change) => mentions(change, stamp))
      // Made by the signed-in super admin, stamped by the triggers.
      for (const change of ours) expect(change.author).toBe(adminUuid)
      tagUuid = ours.find((change) => change.type === 'song_tag')
        ?.uuid as string
      expect(changes.find(isOurVerse)?.data).toMatchObject({
        bookCode: verse.bookCode ?? expect.any(String),
        translationAbbreviation: expect.any(String),
      })
      expect(
        changes.some(
          (change) => change.type === 'setting' && change.uuid === 'theme',
        ),
      ).toBe(false)
      // The music page lists every playlist: leave none behind.
      await request.delete(`/api/music/playlists/${playlistId}`)
    })

    test('a phone changes what its user may; the PC applies it; the rest is refused with the permission', async ({
      request,
    }) => {
      const editor = await userWithPhone(request, `E2E Editor ${Date.now()}`, [
        'songs.view',
        'songs.edit',
      ])
      const tag = await latest(readUrl, 'song_tag', tagUuid)
      const renamed = `${tag.data?.name} (phone)`
      const noteUuid = `e2enote${Date.now()}`
      const written = await phoneWrite(churchId, editor.phone, [
        {
          type: 'song_tag',
          uuid: tagUuid,
          op: 'upsert',
          baseVersion: tag.version,
          data: { ...tag.data, name: renamed, updatedAt: now() + 5 },
        },
        {
          type: 'song_bookmark_note',
          uuid: noteUuid,
          op: 'upsert',
          baseVersion: 0,
          data: {
            uuid: noteUuid,
            content: 'From the phone',
            sortOrder: 99,
            createdAt: now(),
            updatedAt: now(),
          },
        },
      ])
      expect(written.status).toBe(200)

      await syncUntil(
        request,
        async () => (await tagName(request, tagId)) === renamed,
      )
      const notes = (
        await (await request.get('/api/song-bookmark-notes')).json()
      ).data as { content: string }[]
      expect(notes.map((note) => note.content)).toContain('From the phone')
      const editorUuid = (await latest(readUrl, 'song_bookmark_note', noteUuid))
        .author
      expect(editorUuid).not.toBe(adminUuid)
      expect(editorUuid).toBeTruthy()

      // Not theirs to do: a role, a church setting.
      const roleUuid = `e2erole${Date.now()}`
      const role = await phoneWrite(churchId, editor.phone, [
        {
          type: 'role',
          uuid: roleUuid,
          op: 'upsert',
          baseVersion: 0,
          data: { uuid: roleUuid, name: 'Nope', permissions: [] },
        },
      ])
      expect(role.status).toBe(403)
      expect(role.body.rejected[0].permission).toBe('users.create')
      const setting = await phoneWrite(churchId, editor.phone, [
        {
          type: 'setting',
          uuid: 'search_synonyms',
          op: 'upsert',
          baseVersion: (await latest(readUrl, 'setting', 'search_synonyms'))
            .version,
          data: { uuid: 'search_synonyms', value: '[]', updatedAt: now() },
        },
      ])
      expect(setting.status).toBe(403)
      expect(setting.body.rejected).toEqual([
        {
          type: 'setting',
          uuid: 'search_synonyms',
          permission: 'settings.edit',
        },
      ])

      // Made on the version before its own: someone changed it first.
      const stale = await phoneWrite(churchId, editor.phone, [
        {
          type: 'song_tag',
          uuid: tagUuid,
          op: 'upsert',
          baseVersion: tag.version,
          data: { ...tag.data, name: 'Stale', updatedAt: now() + 6 },
        },
      ])
      expect(stale.status).toBe(409)
    })

    test('a change goes out once, even when synced in the second it was made', async ({
      request,
    }) => {
      const name = `E2E Once ${Date.now()}`
      await request.post('/api/users', {
        data: { name, permissions: ['songs.view'] },
      })
      const copies = async () =>
        (await published(readUrl)).filter(
          (change) => change.type === 'user' && change.data?.name === name,
        ).length

      await syncUntil(request, async () => (await copies()) > 0)
      // Sent again, a stale copy would undo a newer change made elsewhere.
      await request.post('/api/sync/now')
      await request.post('/api/sync/now')
      expect(await copies()).toBe(1)
    })

    test('a change made on the PC by someone the church no longer allows is put back and shown', async ({
      page,
      request,
      baseURL,
    }) => {
      const manager = await userWithPhone(
        request,
        `E2E Manager ${Date.now()}`,
        ['users.view', 'users.edit'],
      )
      const name = `E2E Losing ${Date.now()}`
      const losing = await userWithPhone(request, name, [
        'songs.view',
        'songs.edit',
      ])
      const before = await tagName(request, tagId)

      // From the manager's phone: this user may no longer edit songs.
      const user = (await published(readUrl))
        .filter(
          (change) => change.type === 'user' && change.data?.name === name,
        )
        .at(-1) as Change
      const revoked = await phoneWrite(churchId, manager.phone, [
        {
          type: 'user',
          uuid: user.uuid,
          op: 'upsert',
          baseVersion: user.version,
          data: { ...user.data, permissions: ['songs.view'], updatedAt: now() },
        },
      ])
      expect(revoked.status).toBe(200)

      // The PC hasn't heard yet: it lets them rename the tag.
      const asLosing = await playwrightRequest.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
        extraHTTPHeaders: { 'X-User-Auth': losing.loginToken },
      })
      // Test DBs persist between runs: a name no earlier run left behind.
      const edited = await asLosing.post('/api/song-tags', {
        data: { id: tagId, name: `E2E refused ${Date.now()}` },
      })
      expect(edited.ok()).toBe(true)
      await asLosing.dispose()

      // The service refuses it: the tag is put back, the feed says why.
      await syncUntil(
        request,
        async () => (await tagName(request, tagId)) === before,
      )
      const { updates } = (
        await (await request.get('/api/sync/updates')).json()
      ).data as {
        updates: { changeKind: string; entityType: string; detail: string }[]
      }
      expect(updates).toContainEqual(
        expect.objectContaining({
          changeKind: 'rejected',
          entityType: 'song_tag',
          detail: 'songs.edit',
        }),
      )

      await setAppLanguage(page, 'en')
      await page.goto('/settings/backup')
      const refused = page
        .getByRole('listitem')
        .filter({ hasText: 'Not allowed' })
        .filter({ hasText: before ?? '' })
      await expect(refused.first()).toContainText('Needs: Edit songs')
    })
  })
