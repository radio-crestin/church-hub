import { Clock, Folder, ListMusic, Music } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { LibraryNavItem } from './LibraryNavItem'
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="contents lg:block lg:space-y-1">
      <h3 className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:block dark:text-gray-400">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * The views of the music: all of it, the recently played, each playlist and
 * each folder. A column on a large screen, a row to scroll on a phone.
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
      className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:pb-0"
    >
      <Section title={t('library.title')}>
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
      </Section>
      <Section title={t('playlist.title')}>
        {playlists.length === 0 && (
          <p className="hidden px-3 text-sm text-gray-500 lg:block dark:text-gray-400">
            {t('playlist.empty')}
          </p>
        )}
        {playlists.map((playlist) =>
          item(
            { kind: 'playlist', id: playlist.id },
            ListMusic,
            playlist.name,
            playlist.itemCount,
            `music-view-playlist-${playlist.id}`,
          ),
        )}
      </Section>
      <Section title={t('folders.title')}>
        {folders.map((folder) =>
          item(
            { kind: 'folder', id: folder.id },
            Folder,
            folder.name,
            folder.fileCount,
            `music-view-folder-${folder.id}`,
          ),
        )}
      </Section>
    </nav>
  )
}
