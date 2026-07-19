import { dirtyKey, mergeLibraries } from './mergeLibraries'
import type { LibraryFile, LibrarySong } from './types'
import { describe, expect, test } from 'bun:test'

const NOW = 1_800_000_000

function emptyLibrary(device = 'device-a'): LibraryFile {
  return {
    schemaVersion: 1,
    updatedByDevice: device,
    categories: [],
    groups: [],
    songs: [],
    schedules: [],
    tombstones: [],
  }
}

function song(overrides: Partial<LibrarySong> & { uuid: string }): LibrarySong {
  return {
    title: 'Song',
    categoryUuid: null,
    groupUuid: null,
    sourceFilename: null,
    author: null,
    copyright: null,
    ccli: null,
    tempo: null,
    timeSignature: null,
    theme: null,
    altTheme: null,
    hymnNumber: null,
    keyLine: null,
    presentationOrder: null,
    presentationCount: 0,
    lastPresentedAt: null,
    lastManualEdit: null,
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    slides: [],
    ...overrides,
  }
}

describe('mergeLibraries', () => {
  test('first sync (no remote file): keeps local content, upload needed, nothing to apply', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a' }))

    const result = mergeLibraries(local, null, new Set(), NOW)

    expect(result.applyOps).toEqual([])
    expect(result.uploadNeeded).toBe(true)
    expect(result.merged.songs.map((s) => s.uuid)).toEqual(['a'])
  })

  test('remote-only song is applied locally as "added"', () => {
    const remote = emptyLibrary('device-b')
    remote.songs.push(song({ uuid: 'b', title: 'From B' }))

    const result = mergeLibraries(emptyLibrary(), remote, new Set(), NOW)

    expect(result.applyOps).toHaveLength(1)
    expect(result.applyOps[0]).toMatchObject({
      op: 'upsert',
      uuid: 'b',
      changeKind: 'added',
      title: 'From B',
    })
    expect(result.merged.songs.map((s) => s.uuid)).toEqual(['b'])
  })

  test('newer remote version wins and is reported as "updated"', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', title: 'Old', updatedAt: NOW - 500 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(song({ uuid: 'a', title: 'New', updatedAt: NOW - 100 }))

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps[0]).toMatchObject({
      op: 'upsert',
      uuid: 'a',
      changeKind: 'updated',
      title: 'New',
    })
    expect(result.merged.songs[0]?.title).toBe('New')
  })

  test('newer remote over a dirty local row is reported as "conflict"', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', title: 'Mine', updatedAt: NOW - 500 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(
      song({ uuid: 'a', title: 'Theirs', updatedAt: NOW - 100 }),
    )

    const result = mergeLibraries(
      local,
      remote,
      new Set([dirtyKey('song', 'a')]),
      NOW,
    )

    expect(result.applyOps[0]?.changeKind).toBe('conflict')
  })

  test('newer local version wins: no apply op, upload carries it', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', title: 'Newer', updatedAt: NOW - 100 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(song({ uuid: 'a', title: 'Older', updatedAt: NOW - 500 }))

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps).toEqual([])
    expect(result.uploadNeeded).toBe(true)
    expect(result.merged.songs[0]?.title).toBe('Newer')
  })

  test('usage-only difference (presentation count) applies silently', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', updatedAt: NOW - 500 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(
      song({ uuid: 'a', updatedAt: NOW - 100, presentationCount: 7 }),
    )

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps[0]?.silent).toBe(true)
  })

  test('remote tombstone newer than local row deletes it as "removed"', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', updatedAt: NOW - 500 }))
    const remote = emptyLibrary('device-b')
    remote.tombstones.push({
      entityType: 'song',
      uuid: 'a',
      deletedAt: NOW - 100,
    })

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps[0]).toMatchObject({
      op: 'delete',
      uuid: 'a',
      changeKind: 'removed',
    })
    expect(result.merged.songs).toHaveLength(0)
    expect(result.merged.tombstones).toHaveLength(1)
  })

  test('local edit newer than remote tombstone resurrects the song for everyone', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', updatedAt: NOW - 100 }))
    const remote = emptyLibrary('device-b')
    remote.tombstones.push({
      entityType: 'song',
      uuid: 'a',
      deletedAt: NOW - 500,
    })

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps).toEqual([])
    expect(result.merged.songs.map((s) => s.uuid)).toEqual(['a'])
    expect(result.merged.tombstones).toHaveLength(0)
  })

  test('local tombstone newer than remote row propagates the deletion', () => {
    const local = emptyLibrary()
    local.tombstones.push({
      entityType: 'song',
      uuid: 'a',
      deletedAt: NOW - 100,
    })
    const remote = emptyLibrary('device-b')
    remote.songs.push(song({ uuid: 'a', updatedAt: NOW - 500 }))

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps).toEqual([])
    expect(result.merged.songs).toHaveLength(0)
    expect(result.merged.tombstones).toHaveLength(1)
  })

  test('remote row newer than local tombstone is re-added locally', () => {
    const local = emptyLibrary()
    local.tombstones.push({
      entityType: 'song',
      uuid: 'a',
      deletedAt: NOW - 500,
    })
    const remote = emptyLibrary('device-b')
    remote.songs.push(song({ uuid: 'a', updatedAt: NOW - 100 }))

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps[0]).toMatchObject({
      op: 'upsert',
      uuid: 'a',
      changeKind: 'added',
    })
    expect(result.merged.tombstones).toHaveLength(0)
  })

  test('the winning remote version carries its device attribution into the op', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', updatedAt: NOW - 500 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(
      song({
        uuid: 'a',
        title: 'Edited',
        updatedAt: NOW - 100,
        modifiedByDevice: 'Laptop-Biserica',
      }),
    )

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps[0]?.sourceDevice).toBe('Laptop-Biserica')
  })

  test('a clean local winner inherits the remote attribution instead of losing it', () => {
    const local = emptyLibrary()
    local.songs.push(song({ uuid: 'a', updatedAt: NOW - 100 }))
    const remote = emptyLibrary('device-b')
    remote.songs.push(
      song({
        uuid: 'a',
        updatedAt: NOW - 500,
        modifiedByDevice: 'Laptop-Biserica',
      }),
    )

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.merged.songs[0]?.modifiedByDevice).toBe('Laptop-Biserica')
  })

  test('identical local and remote need no upload and no apply', () => {
    const shared = song({ uuid: 'a' })
    const local = emptyLibrary()
    local.songs.push(shared)
    const remote = emptyLibrary('device-b')
    remote.songs.push({ ...shared })

    const result = mergeLibraries(local, remote, new Set(), NOW)

    expect(result.applyOps).toEqual([])
    expect(result.uploadNeeded).toBe(false)
  })

  test('expired tombstones are pruned from the merged file', () => {
    const local = emptyLibrary()
    local.tombstones.push({
      entityType: 'song',
      uuid: 'ancient',
      deletedAt: NOW - 200 * 24 * 3600,
    })

    const result = mergeLibraries(local, null, new Set(), NOW)

    expect(result.merged.tombstones).toHaveLength(0)
  })

  test('rejects a remote file written by a newer schema version', () => {
    const remote = emptyLibrary('device-b')
    remote.schemaVersion = 99

    expect(() =>
      mergeLibraries(emptyLibrary(), remote, new Set(), NOW),
    ).toThrow(/schema v99/)
  })

  test('categories and schedules merge independently of songs', () => {
    const local = emptyLibrary()
    const remote = emptyLibrary('device-b')
    remote.categories.push({
      uuid: 'cat',
      name: 'Worship',
      priority: 1,
      isHidden: 0,
      createdAt: NOW - 100,
      updatedAt: NOW - 100,
    })
    remote.schedules.push({
      uuid: 'sched',
      title: 'Sunday',
      description: null,
      createdAt: NOW - 100,
      updatedAt: NOW - 100,
      items: [],
    })

    const result = mergeLibraries(local, remote, new Set(), NOW)

    const kinds = result.applyOps.map(
      (op) => `${op.entityType}:${op.changeKind}`,
    )
    expect(kinds).toContain('song_category:added')
    expect(kinds).toContain('schedule:added')
  })
})
