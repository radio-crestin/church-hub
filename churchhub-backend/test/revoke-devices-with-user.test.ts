import { expect, test } from 'bun:test'
import { addDevice } from '../src/sync/addDevice'
import { authenticate } from '../src/sync/authenticate'
import { churchPrefix } from '../src/sync/churchPrefix'
import { commitChanges } from '../src/sync/commitChanges'
import { registerChurch } from '../src/sync/registerChurch'
import type { SyncStore } from '../src/sync/state/ChurchState'
import { readChurch } from '../src/sync/state/readChurch'
import type { ChangeInput } from '../src/sync/types'
import { memoryStore } from './helpers/memoryStore'

/**
 * Users and roles reach the service as changes, checked like any other
 * (T-173): each change against its author, and a user a change deactivates
 * or removes has their devices revoked for good, the path moving in the
 * same write. Run with `bun test` from churchhub-backend/.
 */

const editor = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'editor',
  name: 'Editor',
  roleUuid: null,
  isSuperAdmin: 0,
  isActive: 1,
  permissions: ['songs.create', 'songs.edit'],
  ...overrides,
})

/** What a device's token gets from the service now (as every route checks). */
async function signIn(store: SyncStore, churchId: string, token: string) {
  return authenticate(store, await readChurch(store, churchId), `Bearer ${token}`)
}

async function send(
  store: SyncStore,
  churchId: string,
  token: string,
  changes: Omit<ChangeInput, 'baseVersion'>[]
) {
  const caller = await signIn(store, churchId, token)
  const church = await readChurch(store, churchId)
  const versions = church?.state.versions ?? {}
  return commitChanges(
    store,
    caller,
    changes.map((change) => ({
      ...change,
      baseVersion: Math.abs(versions[`${change.type}:${change.uuid}`] ?? 0),
    })),
    40,
    church as NonNullable<typeof church>
  )
}

const userChange = (
  data: Record<string, unknown>,
  author: string | null = null
): Omit<ChangeInput, 'baseVersion'> => ({
  type: 'user',
  uuid: String(data.uuid),
  op: 'upsert',
  author,
  data,
})

const newSong = (author: string | null = null) => {
  const uuid = `song-${crypto.randomUUID()}`
  return { type: 'song', uuid, op: 'upsert', author, data: { uuid } } as const
}

async function setUp() {
  const store = memoryStore()
  const { churchId, serverToken } = await registerChurch(store, 'Church PC')
  await send(store, churchId, serverToken, [userChange(editor())])
  const phone = await addDevice(store, churchId, {
    userId: 'editor',
    name: 'Phone',
  })
  return { store, churchId, serverToken, phone }
}

const refused = (status: number) =>
  expect.objectContaining({ status }) as unknown as Error

test('deactivating a user revokes their device: no writes, no path, old path gone', async () => {
  const { store, churchId, serverToken, phone } = await setUp()
  await send(store, churchId, phone.token, [newSong()])
  const before = (await readChurch(store, churchId))?.state.pathSecret ?? ''

  const { state } = await send(store, churchId, serverToken, [
    userChange(editor({ isActive: 0 })),
  ])

  expect(state.pathSecret).not.toBe(before)
  expect(state.devices.find((d) => !d.isServer)?.revokedAt).not.toBeNull()
  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
  expect(store.bucket.keys().some((key) => key.includes(before))).toBe(false)
  const newHead = `${churchPrefix(churchId, state.pathSecret)}/head.json`
  expect(store.bucket.keys()).toContain(newHead)
})

test('reactivating the user does not bring the device back', async () => {
  const { store, churchId, serverToken, phone } = await setUp()
  await send(store, churchId, serverToken, [userChange(editor({ isActive: 0 }))])

  await send(store, churchId, serverToken, [userChange(editor())])

  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
  const again = await addDevice(store, churchId, { userId: 'editor', name: 'Phone' })
  await send(store, churchId, again.token, [newSong()])
})

test('removing a user revokes their device', async () => {
  const { store, churchId, serverToken, phone } = await setUp()

  await send(store, churchId, serverToken, [
    { type: 'user', uuid: 'editor', op: 'delete', author: null, deletedAt: 1 },
  ])

  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
})

test('the church server keeps its token, and other users keep their devices', async () => {
  const { store, churchId, serverToken } = await setUp()
  await send(store, churchId, serverToken, [
    userChange(editor({ uuid: 'other', name: 'Other' })),
  ])
  const other = await addDevice(store, churchId, { userId: 'other', name: 'Tablet' })

  await send(store, churchId, serverToken, [userChange(editor({ isActive: 0 }))])

  expect((await signIn(store, churchId, serverToken)).isServer).toBe(true)
  expect((await signIn(store, churchId, other.token)).userId).toBe('other')
})

test('a deactivated user gets no new device', async () => {
  const { store, churchId, serverToken } = await setUp()
  await send(store, churchId, serverToken, [userChange(editor({ isActive: 0 }))])

  await expect(
    addDevice(store, churchId, { userId: 'editor', name: 'Phone' })
  ).rejects.toEqual(expect.objectContaining({ code: 'inactive_user' }))
})

test('the PC names each change’s author: their permissions apply, in batch order', async () => {
  const { store, churchId, serverToken } = await setUp()
  const viewer = editor({ uuid: 'viewer', name: 'Viewer', permissions: ['songs.view'] })

  // A user added earlier in the batch may make the next change.
  await send(store, churchId, serverToken, [
    userChange(editor({ uuid: 'new', name: 'New' })),
    newSong('new'),
  ])
  // Not allowed: refused with the permission it needs, nothing published.
  await send(store, churchId, serverToken, [userChange(viewer)])
  await expect(send(store, churchId, serverToken, [newSong('viewer')])).rejects.toEqual(
    expect.objectContaining({
      status: 403,
      details: {
        rejected: [expect.objectContaining({ permission: 'songs.create' })],
      },
    })
  )
  // Only a super admin makes one.
  await expect(
    send(store, churchId, serverToken, [
      userChange(editor({ uuid: 'boss', isSuperAdmin: 1 }), 'editor'),
    ])
  ).rejects.toEqual(refused(403))
})

test('a phone’s changes are its own user’s, whatever author they name', async () => {
  const { store, churchId, phone } = await setUp()

  const { state } = await send(store, churchId, phone.token, [newSong(null)])

  expect(state.seq).toBe(2)
  await expect(
    send(store, churchId, phone.token, [
      userChange(editor({ permissions: ['users.edit'] }), null),
    ])
  ).rejects.toEqual(refused(403))
})
