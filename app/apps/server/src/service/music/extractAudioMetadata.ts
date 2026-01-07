import { parseFile } from 'music-metadata'

import { createLogger } from '../../utils/logger'

const logger = createLogger('music/metadata')

export interface AudioMetadata {
  duration: number | null
  artist: string | null
  album: string | null
  title: string | null
  genre: string | null
  year: number | null
  trackNumber: number | null
}

export async function extractAudioMetadata(
  filePath: string,
): Promise<AudioMetadata> {
  try {
    const metadata = await parseFile(filePath, { duration: true })

    return {
      duration: metadata.format.duration ?? null,
      artist: metadata.common.artist ?? null,
      album: metadata.common.album ?? null,
      title: metadata.common.title ?? null,
      genre: metadata.common.genre?.[0] ?? null,
      year: metadata.common.year ?? null,
      trackNumber: metadata.common.track?.no ?? null,
    }
  } catch (error) {
    logger.debug(`Failed to extract metadata from ${filePath}: ${error}`)
    return {
      duration: null,
      artist: null,
      album: null,
      title: null,
      genre: null,
      year: null,
      trackNumber: null,
    }
  }
}
