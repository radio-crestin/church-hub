import { LibraryBig } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import type { ActionMenuItem } from '~/ui/menu'
import { SubmitToLibraryDialog } from '../components/SubmitToLibraryDialog'

interface SubmitToLibraryAction {
  /** The menu row; null when the user may not edit songs. */
  menuItem: ActionMenuItem | null
  /** The dialog it opens; render it once on the page. */
  dialog: ReactNode
}

/** "Submit to the Church Hub Library" for a song's action menu. */
export function useSubmitToLibraryAction(
  songId: number,
  songTitle: string,
): SubmitToLibraryAction {
  const { t } = useTranslation('songLibrary')
  const { hasPermission } = usePermissions()
  const [isOpen, setIsOpen] = useState(false)

  if (!hasPermission('songs.edit')) return { menuItem: null, dialog: null }

  return {
    menuItem: {
      id: 'submit-to-library',
      label: t('submit.menuLabel'),
      description: t('submit.menuDescription'),
      icon: <LibraryBig size={16} strokeWidth={1.5} />,
      onSelect: () => setIsOpen(true),
      testId: 'song-submit-to-library',
    },
    dialog: (
      <SubmitToLibraryDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        songId={songId}
        songTitle={songTitle}
      />
    ),
  }
}
