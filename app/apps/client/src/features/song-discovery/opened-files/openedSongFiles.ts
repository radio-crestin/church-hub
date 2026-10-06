import type { SongBundleZip } from '@church-hub/song-formats'
import { useSyncExternalStore } from 'react'

import type { SongBundleFile, SongSource } from '../providers/types'

interface OpenedFile {
  source: SongSource
  files: SongBundleFile[]
  ownFormat: boolean
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
  file: SongBundleZip,
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
    { source, files: file.files, ownFormat: file.ownFormat },
  ]
  emit()
  return id
}

export function getOpenedSongFile(sourceId: string): OpenedFile {
  const file = opened.find((f) => f.source.id === sourceId)
  if (!file) throw new Error('The opened song file is no longer available')
  return file
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
