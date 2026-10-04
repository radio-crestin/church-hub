import { History } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import type { ActionMenuItem } from '~/ui/menu'
import { SongHistoryDialog } from '../components/SongHistoryDialog'

interface SongHistoryAction {
  /** The "History" row for the song's action menu; null when the user may not view songs. */
  menuItem: ActionMenuItem | null
  /** The history dialog; render it once anywhere on the page. */
  dialog: ReactNode
}

/**
 * Everything a song page needs to offer the edit history: one menu row and the
 * dialog it opens. Keeps the page's own code to two lines.
 */
export function useSongHistoryAction(
  songId: number,
  songTitle: string,
): SongHistoryAction {
  const { t } = useTranslation('songHistory')
  const { hasPermission } = usePermissions()
  const [isOpen, setIsOpen] = useState(false)

  if (!hasPermission('songs.view')) return { menuItem: null, dialog: null }

  return {
    menuItem: {
      id: 'history',
      label: t('menu.label'),
      description: t('menu.description'),
      icon: <History size={18} />,
      onSelect: () => setIsOpen(true),
      testId: 'song-history',
    },
    dialog: (
      <SongHistoryDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        songId={songId}
        songTitle={songTitle}
        canRestore={hasPermission('songs.edit')}
      />
    ),
  }
}
