import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import type { SongWithSlides } from '~/features/songs/types'
import { generateOpenSongXml, sanitizeFilename } from '../utils'

const LAST_SAVE_PATH_KEY = 'church-hub-last-song-save-path'

export interface SaveSongResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

export function useSaveSongToFile() {
  const [isPending, setIsPending] = useState(false)

  const saveSong = useCallback(
    async (song: SongWithSlides): Promise<SaveSongResult> => {
      const lastPath = localStorage.getItem(LAST_SAVE_PATH_KEY)
      const sanitizedTitle = sanitizeFilename(song.title)
      const defaultFilename = `${sanitizedTitle}.opensong`

      const savePath = await save({
        defaultPath: lastPath
          ? `${lastPath}/${defaultFilename}`
          : defaultFilename,
        filters: [{ name: 'OpenSong', extensions: ['opensong'] }],
      })

      if (!savePath) {
        return { success: false, cancelled: true }
      }

      setIsPending(true)
      try {
        const lastSlashIndex = Math.max(
          savePath.lastIndexOf('/'),
          savePath.lastIndexOf('\\'),
        )
        if (lastSlashIndex > 0) {
          const dirPath = savePath.substring(0, lastSlashIndex)
          localStorage.setItem(LAST_SAVE_PATH_KEY, dirPath)
        }

        const xmlContent = generateOpenSongXml(song)
        const encoder = new TextEncoder()
        await writeFile(savePath, encoder.encode(xmlContent))

        return { success: true, filePath: savePath }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
      }
    },
    [],
  )

  return { saveSong, isPending }
}
