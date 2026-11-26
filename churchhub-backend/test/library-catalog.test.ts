import { expect, test } from 'bun:test'
import { churchOfSource } from '../src/library/churchOfSource'
import { deleteLibrary } from '../src/library/deleteLibrary'
import { libraryKeys } from '../src/library/libraryKeys'
import type { Catalog, LibraryManifest } from '../src/library/types'
import { updateCatalog } from '../src/library/updateCatalog'
import { memoryBucket } from './helpers/memoryStore'

/**
 * A church's shared library (T-176): its folder names its church, and the
 * public catalog lists it only while it is listed. Run with `bun test`.
 */

const manifest = (listed: boolean, name = 'Our songs'): LibraryManifest => ({
  format: 'church-hub-song-bundle',
  version: 3,
  sourceId: 'AAAAAAAAAAAAAAAA-share1',
  name,
  publisher: 'Biserica',
  listed,
  updatedAt: '2026-11-26T00:00:00.000Z',
  songCount: 2,
  checksum: 'x',
  songs: [],
  shards: [],
})

async function readCatalog(bucket: ReturnType<typeof memoryBucket>) {
  const found = await bucket.get(libraryKeys.catalog)
  return found
    ? (JSON.parse(new TextDecoder().decode(found.bytes)) as Catalog)
    : null
}

test('a library folder names the church that owns it', () => {
  expect(churchOfSource('AAAAAAAAAAAAAAAA-share1')).toBe('AAAAAAAAAAAAAAAA')
  expect(churchOfSource('church-hub')).toBeNull()
  expect(churchOfSource('AAAAAAAAAAAAAAAA')).toBeNull()
  expect(churchOfSource('AAAAAAAAAAAAAAAAxshare1')).toBeNull()
})

test('the catalog lists a library while it is listed, and drops it after', async () => {
  const bucket = memoryBucket()
  await updateCatalog(bucket, manifest(false))
  expect(await readCatalog(bucket)).toBeNull()

  await updateCatalog(bucket, manifest(true))
  expect((await readCatalog(bucket))?.libraries).toEqual([
    {
      sourceId: 'AAAAAAAAAAAAAAAA-share1',
      name: 'Our songs',
      publisher: 'Biserica',
      songCount: 2,
      updatedAt: '2026-11-26T00:00:00.000Z',
    },
  ])

  await updateCatalog(bucket, manifest(true, 'Renamed'))
  expect((await readCatalog(bucket))?.libraries.map((l) => l.name)).toEqual([
    'Renamed',
  ])

  await updateCatalog(bucket, manifest(false))
  expect((await readCatalog(bucket))?.libraries).toEqual([])
})

test('deleting a library removes it from the catalog and the bucket', async () => {
  const bucket = memoryBucket()
  const { sourceId } = manifest(true)
  const put = { contentType: 'application/json', cacheControl: 'no-cache' }
  await bucket.put(libraryKeys.manifest(sourceId), new Uint8Array([1]), put)
  await bucket.put(libraryKeys.shard(sourceId, 'a'.repeat(64)), new Uint8Array([1]), put)
  await updateCatalog(bucket, manifest(true))

  await deleteLibrary(bucket, sourceId)
  expect((await readCatalog(bucket))?.libraries).toEqual([])
  expect(await bucket.list(libraryKeys.prefix(sourceId))).toEqual([])
})
