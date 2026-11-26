import { expect, test } from 'bun:test'
import { addDevice } from '../src/sync/addDevice'
import { authenticate } from '../src/sync/authenticate'
import { churchPrefix } from '../src/sync/churchPrefix'
import { commitChanges } from '../src/sync/commitChanges'
import type { AccessUser } from '../src/sync/parseAccess'
import { registerChurch } from '../src/sync/registerChurch'
import type { SyncStore } from '../src/sync/state/ChurchState'
import { readChurch } from '../src/sync/state/readChurch'
import { updateAccess } from '../src/sync/updateAccess'
import { memoryStore } from './helpers/memoryStore'

/**
 * A deactivated or removed user's devices are revoked for good once the
 * church server sends revokeDevicesWithUser with its access; an older server
 * that never sends it keeps today's behaviour. Run with `bun test` from
 * churchhub-backend/.
 */

const editor = (overrides: Partial<AccessUser> = {}): AccessUser => ({
  id: '2',
  name: 'Editor',
  roleId: null,
  isSuperAdmin: false,
  isActive: true,
  permissions: ['songs.create', 'songs.edit'],
  ...overrides,
})

async function setUp(revokeDevicesWithUser: boolean) {
  const store = memoryStore()
  const { churchId } = await registerChurch(store, 'Church PC')
  const access = (users: AccessUser[], signal = revokeDevicesWithUser) =>
    updateAccess(store, churchId, {
      roles: [],
      users,
      revokeDevicesWithUser: signal,
    })
  await access([editor()])
  const phone = await addDevice(store, churchId, {
    userId: '2',
    name: 'Phone',
  })
  return { store, churchId, access, phone }
}

/** What a device's token gets from the service now (as every route checks). */
async function signIn(store: SyncStore, churchId: string, token: string) {
  return authenticate(store, await readChurch(store, churchId), `Bearer ${token}`)
}

async function write(store: SyncStore, churchId: string, token: string) {
  const caller = await signIn(store, churchId, token)
  const church = await readChurch(store, churchId)
  const uuid = `song-${crypto.randomUUID()}`
  return commitChanges(
    store,
    caller,
    [{ type: 'song', uuid, op: 'upsert', baseVersion: 0, data: { uuid } }],
    40,
    church as NonNullable<typeof church>
  )
}

const refused = (status: number) =>
  expect.objectContaining({ status }) as unknown as Error

test('deactivating a user revokes their device: no writes, no path, old path gone', async () => {
  const { store, churchId, access, phone } = await setUp(true)
  await write(store, churchId, phone.token)
  const before = (await readChurch(store, churchId))?.state.pathSecret ?? ''

  const update = await access([editor({ isActive: false })])

  expect(update.revokedDevices).toBe(1)
  expect(update.state.pathSecret).not.toBe(before)
  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
  expect(store.bucket.keys().some((key) => key.includes(before))).toBe(false)
  const newHead = `${churchPrefix(churchId, update.state.pathSecret)}/head.json`
  expect(store.bucket.keys()).toContain(newHead)
})

test('reactivating the user does not bring the device back', async () => {
  const { store, churchId, access, phone } = await setUp(true)
  await access([editor({ isActive: false })])

  const update = await access([editor()])

  expect(update.revokedDevices).toBe(0)
  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
  const again = await addDevice(store, churchId, { userId: '2', name: 'Phone' })
  await write(store, churchId, again.token)
})

test('removing a user revokes their device', async () => {
  const { store, churchId, access, phone } = await setUp(true)

  const update = await access([])

  expect(update.revokedDevices).toBe(1)
  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
})

test('the church server keeps its token, and other users keep their devices', async () => {
  const store = memoryStore()
  const { churchId, serverToken } = await registerChurch(store, 'Church PC')
  const users = [editor(), editor({ id: '3', name: 'Other' })]
  await updateAccess(store, churchId, { roles: [], users, revokeDevicesWithUser: true })
  const other = await addDevice(store, churchId, { userId: '3', name: 'Tablet' })

  await updateAccess(store, churchId, {
    roles: [],
    users: [editor({ isActive: false }), users[1]],
    revokeDevicesWithUser: true,
  })

  expect((await signIn(store, churchId, serverToken)).isServer).toBe(true)
  expect((await signIn(store, churchId, other.token)).userId).toBe('3')
})

test('once asked, the church keeps revoking even if a later update omits the signal', async () => {
  const { store, churchId, access, phone } = await setUp(true)

  const update = await access([editor({ isActive: false })], false)

  expect(update.revokedDevices).toBe(1)
  await expect(signIn(store, churchId, phone.token)).rejects.toEqual(refused(401))
})

test('a deactivated user gets no new device', async () => {
  const { store, churchId, access } = await setUp(true)
  await access([editor({ isActive: false })])

  await expect(
    addDevice(store, churchId, { userId: '2', name: 'Phone' })
  ).rejects.toEqual(expect.objectContaining({ code: 'inactive_user' }))
})

test('an older server (no signal): the device stays, its writes are refused, the path does not move', async () => {
  const { store, churchId, access, phone } = await setUp(false)
  const before = (await readChurch(store, churchId))?.state.pathSecret

  const update = await access([editor({ isActive: false })])

  expect(update.revokedDevices).toBe(0)
  expect(update.state.pathSecret).toBe(before)
  expect((await signIn(store, churchId, phone.token)).userId).toBe('2')
  await expect(write(store, churchId, phone.token)).rejects.toEqual(refused(403))
  // Reactivated, the same device writes again, as before.
  await access([editor()])
  await write(store, churchId, phone.token)
  await access([editor({ isActive: false })])
  await addDevice(store, churchId, { userId: '2', name: 'Inactive is fine' })
})
