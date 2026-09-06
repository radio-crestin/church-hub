import { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditorModal } from '~/features/songs/components'
import { useToast } from '~/ui/toast'
import { AddScheduleItemModal } from './AddScheduleItemModal'
import { BiblePassagePickerModal } from './BiblePassagePickerModal'
import { InsertSlideModal } from './InsertSlideModal'
import { ScenePickerModal } from './ScenePickerModal'
import { useAddItemToSchedule } from '../hooks'
import type { ScheduleItem, SlideTemplate } from '../types'

export interface ScheduleItemEditorsHandle {
  /** Opens the right editor for this item, by kind. */
  editItem: (item: ScheduleItem) => void
}

interface ScheduleItemEditorsProps {
  scheduleId: number
  /** Called after anything is added or saved, so the caller can refetch. */
  onChanged?: () => void
  /** Icon-only trigger, for the narrow Programe panel header. */
  compactTrigger?: boolean
}

/**
 * Adding and editing a program's items, from anywhere that lists them.
 *
 * Every dialog here is the program page's own — the add menu, the slide
 * editor, the passage picker, the scene picker, the song editor. The Programe
 * panel borrows them wholesale rather than growing a second, thinner set that
 * would drift: an announcement edited from the song page must behave exactly
 * like one edited from the program page.
 *
 * Renders the add trigger in place; editing is driven imperatively through the
 * ref, because the trigger for that is a button on each row.
 */
export const ScheduleItemEditors = forwardRef<
  ScheduleItemEditorsHandle,
  ScheduleItemEditorsProps
>(function ScheduleItemEditors(
  { scheduleId, onChanged, compactTrigger = false },
  ref,
) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const addItemMutation = useAddItemToSchedule()

  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideTemplate, setSlideTemplate] =
    useState<SlideTemplate>('announcement')
  const [editingSlideItem, setEditingSlideItem] = useState<ScheduleItem | null>(
    null,
  )
  const [showBiblePassagePicker, setShowBiblePassagePicker] = useState(false)
  const [editingBiblePassageItem, setEditingBiblePassageItem] =
    useState<ScheduleItem | null>(null)
  const [showScenePicker, setShowScenePicker] = useState(false)
  const [editingSongId, setEditingSongId] = useState<number | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      editItem: (item: ScheduleItem) => {
        if (item.itemType === 'song' && item.songId) {
          setEditingSongId(item.songId)
        } else if (item.itemType === 'bible_passage') {
          setEditingBiblePassageItem(item)
        } else if (item.itemType === 'slide') {
          setEditingSlideItem(item)
        }
      },
    }),
    [],
  )

  const handleAddSong = useCallback(
    (songId: number) => {
      addItemMutation.mutate(
        { scheduleId, input: { songId } },
        {
          onSuccess: () => onChanged?.(),
          onError: () => showToast(t('messages.error'), 'error'),
        },
      )
    },
    [addItemMutation, onChanged, scheduleId, showToast, t],
  )

  const handleSceneSelect = useCallback(
    (obsSceneName: string) => {
      addItemMutation.mutate(
        { scheduleId, input: { slideType: 'scene', obsSceneName } },
        { onSuccess: () => onChanged?.() },
      )
    },
    [addItemMutation, onChanged, scheduleId],
  )

  return (
    <>
      <AddScheduleItemModal
        isOpen={showAddMenu}
        onOpenChange={setShowAddMenu}
        onAddSong={handleAddSong}
        onAddBiblePassage={() => setShowBiblePassagePicker(true)}
        onAddSlide={(template) => {
          setSlideTemplate(template)
          setShowSlideModal(true)
        }}
        onAddScene={() => setShowScenePicker(true)}
        compactTrigger={compactTrigger}
      />

      <InsertSlideModal
        isOpen={showSlideModal || !!editingSlideItem}
        onClose={() => {
          // Adding (not editing) came from the type menu — go back to it.
          if (showSlideModal && !editingSlideItem) setShowAddMenu(true)
          setShowSlideModal(false)
          setEditingSlideItem(null)
        }}
        scheduleId={scheduleId}
        initialTemplate={slideTemplate}
        editingItem={
          editingSlideItem
            ? {
                id: editingSlideItem.id,
                slideType: editingSlideItem.slideType,
                slideContent: editingSlideItem.slideContent,
                verseteTineriEntries: editingSlideItem.verseteTineriEntries,
              }
            : undefined
        }
        onSaved={() => onChanged?.()}
      />

      <BiblePassagePickerModal
        isOpen={showBiblePassagePicker || !!editingBiblePassageItem}
        onClose={() => {
          if (showBiblePassagePicker && !editingBiblePassageItem) {
            setShowAddMenu(true)
          }
          setShowBiblePassagePicker(false)
          setEditingBiblePassageItem(null)
        }}
        scheduleId={scheduleId}
        editingItem={
          editingBiblePassageItem
            ? {
                id: editingBiblePassageItem.id,
                biblePassageReference:
                  editingBiblePassageItem.biblePassageReference,
              }
            : undefined
        }
        onSaved={() => onChanged?.()}
      />

      <ScenePickerModal
        isOpen={showScenePicker}
        onClose={() => {
          setShowAddMenu(true)
          setShowScenePicker(false)
        }}
        onSceneSelect={(obsSceneName) => {
          handleSceneSelect(obsSceneName)
          setShowScenePicker(false)
        }}
      />

      {editingSongId !== null && (
        <SongEditorModal
          isOpen={editingSongId !== null}
          songId={editingSongId}
          onClose={() => setEditingSongId(null)}
          onSaved={() => onChanged?.()}
        />
      )}
    </>
  )
})
