import { AddMenuModal } from '~/ui/AddMenuModal'
import type { SlideTemplate } from '../types'

interface AddToQueueMenuProps {
  onAddSong: () => void
  onAddBibleVerse?: () => void
  onAddBiblePassage?: () => void
  onAddSlide: (template: SlideTemplate) => void
  onImportSchedule?: () => void
}

export function AddToQueueMenu({
  onAddSong,
  onAddBibleVerse,
  onAddBiblePassage,
  onAddSlide,
  onImportSchedule,
}: AddToQueueMenuProps) {
  return (
    <AddMenuModal
      showBibleVerse={!!onAddBibleVerse}
      showBiblePassage={!!onAddBiblePassage}
      showImportSchedule={!!onImportSchedule}
      onAddSong={onAddSong}
      onAddBibleVerse={onAddBibleVerse}
      onAddBiblePassage={onAddBiblePassage}
      onAddAnnouncement={() => onAddSlide('announcement')}
      onAddVerseteTineri={() => onAddSlide('versete_tineri')}
      onImportSchedule={onImportSchedule}
    />
  )
}
