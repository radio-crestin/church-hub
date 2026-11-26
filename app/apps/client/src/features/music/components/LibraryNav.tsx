import { Clock, Folder, ListMusic, Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LibraryNavItem } from './LibraryNavItem'
import { MusicSection } from './MusicSection'
import { useMusicFiles, useMusicFolders, usePlaylists } from '../hooks'
import type { LibraryView } from '../types'

interface LibraryNavProps {
  view: LibraryView
  onSelect: (view: LibraryView) => void
}

function isView(view: LibraryView, other: LibraryView): boolean {
  return (
    view.kind === other.kind &&
    ('id' in view ? view.id : null) === ('id' in other ? other.id : null)
  )
}

/**
 * The views of the music, in three sections: the whole library and the
 * recently played, the playlists, the folders.
 */
export function LibraryNav({ view, onSelect }: LibraryNavProps) {
  const { t } = useTranslation('music')
  const { data: folders = [] } = useMusicFolders()
  const { data: playlists = [] } = usePlaylists()
  const { data: recent = [] } = useMusicFiles({ recent: true })

  const totalCount = folders.reduce((sum, folder) => sum + folder.fileCount, 0)

  const item = (
    target: LibraryView,
    icon: typeof Music,
    label: string,
    count: number,
    testId: string,
  ) => (
    <LibraryNavItem
      key={testId}
      icon={icon}
      label={label}
      count={count}
      isSelected={isView(view, target)}
      onSelect={() => onSelect(target)}
      testId={testId}
    />
  )

  return (
    <nav
      aria-label={t('library.title')}
      data-testid="music-library-nav"
      className="flex flex-col divide-y divide-line"
    >
      <MusicSection title={t('library.title')} testId="music-library">
        <div className="flex flex-col gap-0.5">
          {item(
            { kind: 'all' },
            Music,
            t('library.all'),
            totalCount,
            'music-view-all',
          )}
          {item(
            { kind: 'recent' },
            Clock,
            t('library.recent'),
            recent.length,
            'music-view-recent',
          )}
        </div>
      </MusicSection>
      <MusicSection
        title={t('playlist.title')}
        variant="group"
        testId="music-playlists"
      >
        {playlists.length === 0 && (
          <p className="px-2.5 pb-1 text-sm text-fg-hint">
            {t('playlist.empty')}
          </p>
        )}
        <div className="flex flex-col gap-0.5 empty:hidden">
          {playlists.map((playlist) =>
            item(
              { kind: 'playlist', id: playlist.id },
              ListMusic,
              playlist.name,
              playlist.itemCount,
              `music-view-playlist-${playlist.id}`,
            ),
          )}
        </div>
      </MusicSection>
      <MusicSection
        title={t('folders.title')}
        variant="group"
        testId="music-folders"
      >
        {folders.length === 0 && (
          <p className="px-2.5 pb-1 text-sm text-fg-hint">
            {t('folders.empty')}
          </p>
        )}
        <div className="flex flex-col gap-0.5 empty:hidden">
          {folders.map((folder) =>
            item(
              { kind: 'folder', id: folder.id },
              Folder,
              folder.name,
              folder.fileCount,
              `music-view-folder-${folder.id}`,
            ),
          )}
        </div>
      </MusicSection>
    </nav>
  )
}
