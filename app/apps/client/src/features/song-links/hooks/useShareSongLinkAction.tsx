import { Link2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ActionMenuItem } from '~/ui/menu'
import { ShareSongLinkDialog } from '../components/ShareSongLinkDialog'

interface ShareSongLinkAction {
  menuItem: ActionMenuItem
  /** The dialog it opens; render it once on the page. */
  dialog: ReactNode
}

/** "Share link" for a song's action menu: a public page of the song. */
export function useShareSongLinkAction(songId: number): ShareSongLinkAction {
  const { t } = useTranslation('songLibrary')
  const [isOpen, setIsOpen] = useState(false)
  return {
    menuItem: {
      id: 'share-song-link',
      label: t('link.menuLabel'),
      description: t('link.menuDescription'),
      icon: <Link2 size={16} strokeWidth={1.5} />,
      onSelect: () => setIsOpen(true),
      testId: 'song-share-link',
    },
    dialog: (
      <ShareSongLinkDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        songId={songId}
      />
    ),
  }
}
