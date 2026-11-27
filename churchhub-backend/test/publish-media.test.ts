import { describe, expect, test } from 'bun:test'
import { memoryStore } from './helpers/memoryStore'
import { parseMediaItems } from '../src/sync/media/parseMediaItems'
import { mediaIndexKey, mediaKey, publishMedia } from '../src/sync/media/publishMedia'
import type { ChurchState } from '../src/sync/state/ChurchState'

const state = { id: 'c1', pathSecret: 's3cr3t' } as ChurchState
const prefix = 'churches/c1-s3cr3t'
const hash = (n: number) => String(n).repeat(64).slice(0, 64)
const limits = { maxBytes: 100, maxFileBytes: 60 }
const image = (id: string, n: number, size: number) => ({
  id,
  hash: hash(n),
  size,
  type: 'image/jpeg',
})

async function index(store: ReturnType<typeof memoryStore>) {
  const object = await store.bucket.get(mediaIndexKey(prefix))
  return JSON.parse(new TextDecoder().decode(object?.bytes)).media
}

describe('publishMedia', () => {
  test('uploads what is missing, then lists it; one object per content', async () => {
    const store = memoryStore()
    const items = [image('a.jpg', 1, 10), image('b.jpg', 1, 10)]
    const first = await publishMedia(store, state, items, limits)
    expect(first.uploads.map((u) => u.hash)).toEqual([hash(1)])
    expect(first.available).toBe(0)
    expect(await index(store)).toEqual({})

    await store.bucket.put(mediaKey(prefix, hash(1)), new Uint8Array(10), {
      contentType: 'image/jpeg',
      cacheControl: 'immutable',
    })
    const second = await publishMedia(store, state, items, limits)
    expect(second.uploads).toEqual([])
    expect(Object.keys(await index(store))).toEqual(['a.jpg', 'b.jpg'])
  })

  test('skips files over the limits, in the order sent', async () => {
    const store = memoryStore()
    const result = await publishMedia(
      store,
      state,
      [image('big.jpg', 1, 61), image('a.jpg', 2, 60), image('b.jpg', 3, 41)],
      limits
    )
    expect(result.skipped).toEqual([
      { id: 'big.jpg', reason: 'file_too_large' },
      { id: 'b.jpg', reason: 'church_limit' },
    ])
    expect(result.uploads.map((u) => u.hash)).toEqual([hash(2)])
  })

  test('deletes files no longer referenced', async () => {
    const store = memoryStore()
    await store.bucket.put(mediaKey(prefix, hash(9)), new Uint8Array(1), {
      contentType: 'image/jpeg',
      cacheControl: 'immutable',
    })
    await publishMedia(store, state, [], limits)
    expect(await store.bucket.get(mediaKey(prefix, hash(9)))).toBeNull()
  })

  test('refuses an invalid item', () => {
    expect(() => parseMediaItems({ items: [{ id: '../x', hash: hash(1), size: 1, type: 'image/jpeg' }] })).toThrow()
    expect(() => parseMediaItems({ items: [{ id: 'a.svg', hash: hash(1), size: 1, type: 'image/svg+xml' }] })).toThrow()
  })
})
