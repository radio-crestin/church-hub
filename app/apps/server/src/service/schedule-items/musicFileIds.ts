import type { MusicItemConfig } from './types'
import { getFileById, getFiles } from '../music'

/** The tracks a music item plays, in the library's order or as picked. */
export function musicFileIds(config: MusicItemConfig): number[] {
  if (config.source === 'folder') {
    return getFiles({ folderId: config.folderId }).map((file) => file.id)
  }
  return config.fileIds.filter((id) => getFileById(id) !== null)
}
