import { useCallback, useRef } from 'react'

import type { KeyLineEditDialogHandle } from '~/features/song-key'
import { getSongById } from '~/features/songs/service'
import type { ScheduleItem } from '../types'

/**
 * Opens the shared gama editor (KeyLineEditDialog) for a program song. Mount
 * `<KeyLineEditDialog ref={keyLineDialogRef} />` next to the list using it.
 */
export function useScheduleKeyLineEditor() {
  const keyLineDialogRef = useRef<KeyLineEditDialogHandle>(null)

  const editKeyLine = useCallback(async (item: ScheduleItem) => {
    if (item.itemType !== 'song' || !item.songId) return
    const song = await getSongById(item.songId)
    if (song) keyLineDialogRef.current?.open(song)
  }, [])

  return { keyLineDialogRef, editKeyLine }
}
