import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useSetScheduleItemConfig } from './hooks/useSetScheduleItemConfig'
import { isMediaItem } from './isMediaItem'
import { MusicItemDialog } from './MusicItemDialog'
import type {
  ItemConfig,
  MediaItemType,
  MusicItemConfig,
  VersesItemConfig,
  VideoItemConfig,
} from './types'
import { VersesItemDialog } from './VersesItemDialog'
import { VideoItemDialog } from './VideoItemDialog'
import { useAddItemToSchedule } from '../hooks'
import type { ScheduleItem } from '../types'

export interface MediaItemEditorsHandle {
  /** Opens a new item's settings, added at the end or after `afterItemId`. */
  add: (type: MediaItemType, afterItemId?: number) => void
  /** Opens an item's settings; false when it isn't a music, video or verses item. */
  edit: (item: ScheduleItem) => boolean
}

interface MediaItemEditorsProps {
  scheduleId: number
  /** Called once an item is added or saved. */
  onChanged?: () => void
  /** Adding was cancelled: the host can reopen its add menu. */
  onAddCancelled?: () => void
}

type Open =
  | { mode: 'add'; type: MediaItemType; afterItemId?: number }
  | { mode: 'edit'; type: MediaItemType; item: ScheduleItem }

/**
 * The settings dialogs of the music, video and verses items, for every list
 * of a presentation's items (its page and the Prezentări panel).
 */
export const MediaItemEditors = forwardRef<
  MediaItemEditorsHandle,
  MediaItemEditorsProps
>(function MediaItemEditors({ scheduleId, onChanged, onAddCancelled }, ref) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const [open, setOpen] = useState<Open | null>(null)
  const addItem = useAddItemToSchedule()
  const setConfig = useSetScheduleItemConfig()

  useImperativeHandle(
    ref,
    () => ({
      add: (type, afterItemId) => setOpen({ mode: 'add', type, afterItemId }),
      edit: (item) => {
        if (!isMediaItem(item)) return false
        setOpen({ mode: 'edit', type: item.itemType, item })
        return true
      },
    }),
    [],
  )

  if (!open) return null

  const close = () => {
    if (open.mode === 'add') onAddCancelled?.()
    setOpen(null)
  }
  const done = (messageKey: string) => {
    showToast(t(messageKey), 'success')
    setOpen(null)
    onChanged?.()
  }
  const failed = () => showToast(t('messages.error'), 'error')

  const save = (itemConfig: ItemConfig) => {
    if (open.mode === 'edit') {
      setConfig.mutate(
        { scheduleId, itemId: open.item.id, itemConfig },
        { onSuccess: () => done('messages.slideUpdated'), onError: failed },
      )
      return
    }
    addItem.mutate(
      {
        scheduleId,
        input: {
          media: { itemType: open.type, itemConfig },
          afterItemId: open.afterItemId,
        },
      },
      {
        onSuccess: (result) =>
          result.success ? done('messages.itemAdded') : failed(),
        onError: failed,
      },
    )
  }

  const initial = open.mode === 'edit' ? open.item.itemConfig : null
  const props = {
    isSaving: addItem.isPending || setConfig.isPending,
    onSave: save,
    onClose: close,
  }
  switch (open.type) {
    case 'music':
      return <MusicItemDialog {...props} initial={initial as MusicItemConfig} />
    case 'video':
      return <VideoItemDialog {...props} initial={initial as VideoItemConfig} />
    case 'verses':
      return (
        <VersesItemDialog {...props} initial={initial as VersesItemConfig} />
      )
  }
})
