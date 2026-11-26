import { ListMusic } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import { useEditLayoutAction, Workspace } from '~/features/workspace'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { Button } from '~/ui/button'
import { ActionMenu } from '~/ui/menu'
import { Page, PageHeader } from '~/ui/page'
import { AddFolderButton } from './AddFolderButton'
import { LibraryNav } from './LibraryNav'
import { MusicPanel } from './MusicPanel'
import { NameModal } from './NameModal'
import { PlayerDeck } from './PlayerDeck'
import { PlayerQueue } from './PlayerQueue'
import { Scrollable } from './Scrollable'
import { TrackPanel } from './TrackPanel'
import {
  useAddToPlaylist,
  useMusicFolders,
  usePlaylists,
  useServerAudioPlayer,
  useUpsertPlaylist,
} from '../hooks'
import type { LibraryTrack, LibraryView } from '../types'

const WORKSPACE_ID = 'music-library'

/**
 * Like the Songs page: the library's views on the left, the chosen view's
 * tracks in the middle, the player and its queue on the right. On a phone the
 * player stays pinned on top, over the tracks, library and queue as tabs.
 */
const MUSIC_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['library'] },
    { id: 'col-2', panelIds: ['tracks'] },
    { id: 'col-3', panelIds: ['player'] },
  ],
}

export function MusicPage() {
  const { t } = useTranslation('music')
  const { t: tCommon } = useTranslation('common')
  const player = useServerAudioPlayer()
  const isLargeScreen = useMediaQuery('(min-width: 1024px)')
  const [view, setView] = useState<LibraryView>({ kind: 'all' })
  const [phoneTab, setPhoneTab] = useState('tracks')
  const [search, setSearch] = useState('')
  // The new playlist being named, and the track it starts with, if any.
  const [newPlaylist, setNewPlaylist] = useState<{
    track?: LibraryTrack
  } | null>(null)
  const { data: playlists = [] } = usePlaylists()
  const { data: folders = [] } = useMusicFolders()
  const upsertPlaylist = useUpsertPlaylist()
  const addToPlaylist = useAddToPlaylist()

  const viewName =
    view.kind === 'all'
      ? t('library.all')
      : view.kind === 'recent'
        ? t('library.recent')
        : view.kind === 'playlist'
          ? (playlists.find((p) => p.id === view.id)?.name ?? '')
          : (folders.find((f) => f.id === view.id)?.name ?? '')

  // Picking a view on a phone opens its tracks.
  const selectView = useCallback((next: LibraryView) => {
    setView(next)
    setSearch('')
    setPhoneTab('tracks')
  }, [])

  const handleAddToQueue = useCallback(
    (tracks: LibraryTrack[]) =>
      player.addToQueue(tracks.map((track) => track.id)),
    [player],
  )

  const createPlaylist = async (name: string) => {
    const track = newPlaylist?.track
    setNewPlaylist(null)
    const playlist = await upsertPlaylist.mutateAsync({ name })
    if (!playlist) return
    if (track) {
      await addToPlaylist.mutateAsync({
        playlistId: playlist.id,
        fileId: track.id,
      })
    }
    selectView({ kind: 'playlist', id: playlist.id })
  }

  const workspacePanels: WorkspacePanel[] = [
    {
      id: 'deck',
      title: t('player.title'),
      pinned: true,
      available: !isLargeScreen,
      render: () => (
        <MusicPanel>
          <PlayerDeck player={player} />
        </MusicPanel>
      ),
    },
    {
      id: 'player',
      title: t('player.title'),
      available: isLargeScreen,
      render: () => (
        <MusicPanel>
          <PlayerDeck player={player} />
          <PlayerQueue player={player} />
        </MusicPanel>
      ),
    },
    {
      id: 'tracks',
      title: t('tracks.title'),
      render: () => (
        <MusicPanel>
          <TrackPanel
            scrollable={isLargeScreen}
            view={view}
            viewName={viewName}
            search={search}
            onSearchChange={setSearch}
            playlists={playlists}
            playingFileId={player.currentTrack?.fileId ?? null}
            onPlay={(track) => player.playFile(track.id)}
            onAddToQueue={handleAddToQueue}
            onCreatePlaylistWith={(track) => setNewPlaylist({ track })}
            onViewRemoved={() => selectView({ kind: 'all' })}
          />
        </MusicPanel>
      ),
    },
    {
      id: 'library',
      title: t('library.title'),
      render: () => (
        <MusicPanel>
          <Scrollable enabled={isLargeScreen}>
            <LibraryNav view={view} onSelect={selectView} />
          </Scrollable>
        </MusicPanel>
      ),
    },
    {
      id: 'queue',
      title: t('player.queue'),
      available: !isLargeScreen,
      render: () => (
        <MusicPanel>
          <PlayerQueue player={player} />
        </MusicPanel>
      ),
    },
  ]

  const editLayoutAction = useEditLayoutAction(WORKSPACE_ID)

  return (
    <Page>
      <PageHeader
        title={t('title')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setNewPlaylist({})}
              className="shrink-0"
              data-testid="music-new-playlist"
            >
              <ListMusic className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('playlist.new')}</span>
            </Button>
            <AddFolderButton />
            {/* Panels only form movable columns on a large screen. */}
            <ActionMenu
              items={isLargeScreen ? [editLayoutAction] : []}
              label={tCommon('actionsMenu.trigger')}
              testId="music-actions-menu"
            />
          </>
        }
      />

      <Workspace
        id={WORKSPACE_ID}
        panels={workspacePanels}
        defaultLayout={MUSIC_WORKSPACE_LAYOUT}
        defaultColumnSizes={['20%', '52%', '28%']}
        stacked={!isLargeScreen}
        stackedAsTabs
        activeTab={phoneTab}
        onActiveTabChange={setPhoneTab}
        className="flex-1 lg:min-h-0"
      />

      <NameModal
        isOpen={newPlaylist !== null}
        title={t('playlist.new')}
        message={
          newPlaylist?.track
            ? t('playlist.newWithTrack', {
                title: newPlaylist.track.title || newPlaylist.track.filename,
              })
            : t('playlist.newMessage')
        }
        label={t('playlist.name')}
        confirmLabel={t('playlist.create')}
        onConfirm={createPlaylist}
        onCancel={() => setNewPlaylist(null)}
      />
    </Page>
  )
}
