import { AddMenuModal } from '~/ui/AddMenuModal'
import type { SlideTemplate } from '../types'

interface AddToScheduleMenuProps {
  onAddSong: () => void
  onAddBibleVerse?: () => void
  onAddBiblePassage?: () => void
  onAddSlide: (template: SlideTemplate) => void
  /** Controlled open state (optional) */
  isOpen?: boolean
  /** Callback when open state changes (for controlled mode) */
  onOpenChange?: (open: boolean) => void
}

export function AddToScheduleMenu({
  onAddSong,
  onAddBibleVerse,
  onAddBiblePassage,
  onAddSlide,
  isOpen,
  onOpenChange,
}: AddToScheduleMenuProps) {
  return (
    <AddMenuModal
      showBibleVerse={!!onAddBibleVerse}
      showBiblePassage={!!onAddBiblePassage}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onAddSong={onAddSong}
      onAddBibleVerse={onAddBibleVerse}
      onAddBiblePassage={onAddBiblePassage}
      onAddAnnouncement={() => onAddSlide('announcement')}
      onAddVerseteTineri={() => onAddSlide('versete_tineri')}
    />
  )
}
