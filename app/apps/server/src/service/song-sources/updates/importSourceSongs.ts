import type { SourceSong } from '@church-hub/song-formats'

import type { SongRef } from './types'
import { getRawDatabase } from '../../../db'
import {
  type BatchImportSongInput,
  batchImportSongs,
  batchUpdateSearchIndex,
  getAllCategories,
  upsertCategory,
} from '../../songs'
import type { SongSource } from '../types'

function toBatchSong({
  parsed,
  sourceFilename,
}: SourceSong): BatchImportSongInput {
  const { metadata } = parsed
  return {
    title: parsed.title,
    sourceFilename,
    author: metadata.author,
    copyright: metadata.copyright,
    ccli: metadata.ccli,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    theme: metadata.theme,
    altTheme: metadata.altTheme,
    hymnNumber: metadata.hymnNumber,
    keyLine: metadata.keyLine,
    presentationOrder: metadata.presentationOrder,
    slides: parsed.slides.map((slide, index) => ({
      content: slide.htmlContent,
      sortOrder: index,
      label: slide.label ?? null,
    })),
  }
}

/** The source's category, created the first time a source adds songs. */
function sourceCategoryId(source: SongSource): number | null {
  const existing = getAllCategories().find(
    (category) => category.name === source.categoryName,
  )
  return (
    existing?.id ?? upsertCategory({ name: source.categoryName })?.id ?? null
  )
}

const CHUNK = 500

function titlesOf(ids: number[]): SongRef[] {
  const songs: SongRef[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const marks = chunk.map(() => '?').join(',')
    const rows = getRawDatabase()
      .query(`SELECT id, title FROM songs WHERE id IN (${marks})`)
      .all(...chunk) as SongRef[]
    songs.push(...rows)
  }
  return songs
}

/** Adds songs to the library in the source's category; returns them. */
export function importSourceSongs(
  source: SongSource,
  songs: SourceSong[],
): SongRef[] {
  if (songs.length === 0) return []
  const result = batchImportSongs(
    songs.map(toBatchSong),
    sourceCategoryId(source),
    false,
    false,
  )
  batchUpdateSearchIndex(result.songIds)
  return titlesOf(result.songIds)
}
