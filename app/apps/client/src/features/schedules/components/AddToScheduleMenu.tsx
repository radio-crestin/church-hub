import { AddMenuModal } from '~/ui/AddMenuModal'
import type { SlideTemplate } from '../types'

interface AddToScheduleMenuProps {
  onAddSong: () => void
  onAddBibleVerse?: () => void
  onAddBiblePassage?: () => void
  onAddSlide: (template: SlideTemplate) => void
}

export function AddToScheduleMenu({
  onAddSong,
  onAddBibleVerse,
  onAddBiblePassage,
  onAddSlide,
}: AddToScheduleMenuProps) {
  return (
    <AddMenuModal
      showBibleVerse={!!onAddBibleVerse}
      showBiblePassage={!!onAddBiblePassage}
      onAddSong={onAddSong}
      onAddBibleVerse={onAddBibleVerse}
      onAddBiblePassage={onAddBiblePassage}
      onAddAnnouncement={() => onAddSlide('announcement')}
      onAddVerseteTineri={() => onAddSlide('versete_tineri')}
    />
  )
}
