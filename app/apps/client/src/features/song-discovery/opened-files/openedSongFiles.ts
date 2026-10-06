import { useSyncExternalStore } from 'react'

import type { SongBundleFile } from './readSongBundleFile'
import type { SongBundleSong, SongSource } from '../providers/types'

interface OpenedFile {
  source: SongSource
  songs: SongBundleSong[]
}

/**
 * `.chsongs` files the user opened this session, offered in Song discovery
 * next to the other sources until the app closes. Nothing is stored.
 */
let opened: OpenedFile[] = []
let snapshot: SongSource[] = []
const listeners = new Set<() => void>()

function emit() {
  snapshot = opened.map((file) => file.source)
  for (const listener of listeners) listener()
}

/** Adds an opened file as a source and returns its id. */
export function addOpenedSongFile(
  fileName: string,
  file: SongBundleFile,
): string {
  const id = `file-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const source: SongSource = {
    id,
    name: file.name,
    categoryName: file.categoryName,
    format: 'song-bundle-file',
    url: fileName,
    origin: 'file',
  }
  opened = [
    ...opened.filter((f) => f.source.id !== id),
    { source, songs: file.songs },
  ]
  emit()
  return id
}

export function getOpenedSongFileSongs(sourceId: string): SongBundleSong[] {
  const file = opened.find((f) => f.source.id === sourceId)
  if (!file) throw new Error('The opened song file is no longer available')
  return file.songs
}

/** The opened files as sources, re-rendering when one is opened. */
export function useOpenedSongFileSources(): SongSource[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
  )
}
