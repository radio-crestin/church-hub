import { readSongBundleZip } from '@church-hub/song-formats'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { addOpenedSongFile } from './openedSongFiles'
import { catalogQueryKey } from '../hooks/useFetchCatalog'

/** Extension of Church Hub song files (song bundles). */
export const SONG_FILE_EXTENSION = '.chsongs'

export const isSongFile = (name: string) =>
  name.toLowerCase().endsWith(SONG_FILE_EXTENSION)

/**
 * Opens a `.chsongs` file: its songs show in Song discovery as a source of
 * their own, for review before anything is imported.
 */
export function useOpenSongFile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { t } = useTranslation('songDiscovery')

  return useCallback(
    async (data: ArrayBuffer | Uint8Array, fileName: string) => {
      try {
        const file = await readSongBundleZip(data)
        const name = fileName.split(/[/\\]/).pop() ?? fileName
        const sourceId = addOpenedSongFile(name, file)
        queryClient.removeQueries({ queryKey: catalogQueryKey(sourceId) })
        await navigate({ to: '/songs/discover', search: { source: sourceId } })
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('[song-file] Failed to open song file:', error)
        showToast(t('songFile.openFailed', { error: String(error) }), 'error')
      }
    },
    [navigate, queryClient, showToast, t],
  )
}
