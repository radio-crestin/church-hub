import { expect, test } from 'bun:test'
import { publishHead } from '../src/sync/publishHead'
import type { ChurchState, SyncStore } from '../src/sync/state/ChurchState'
import { encryptState } from '../src/sync/state/encryptState'

/**
 * publishHead re-publishes after concurrent writes, but a state that keeps
 * changing can't hold it in a loop. Run with `bun test` from churchhub-backend/.
 */
const SECRET = 'test-sync-secret'

const state: ChurchState = {
  schemaVersion: 1,
  id: 'church1',
  pathSecret: 'fake-path-secret',
  seq: 1,
  snapshot: null,
  segments: [],
  devices: [],
  roles: [],
  users: [],
  versions: {},
  createdAt: 0,
  updatedAt: 0,
}

test('stops re-publishing while the state keeps changing', async () => {
  const sealed = await encryptState(state, SECRET)
  let puts = 0
  let version = 0
  const store = {
    secret: SECRET,
    bucket: { put: async () => (puts++, 'etag') },
    states: {
      // Every look finds a newer state: a write that never settles.
      etag: async () => `"v${++version}"`,
      get: async () => ({ bytes: sealed.buffer, etag: `"v${version}"` }),
    },
  } as unknown as SyncStore

  const head = await publishHead(store, state, '"v0"')
  expect(head.seq).toBe(1)
  expect(puts).toBe(8)
})
