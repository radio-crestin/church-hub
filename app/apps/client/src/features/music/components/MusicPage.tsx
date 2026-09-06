import { MoreHorizontal, Music } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import 'overlayscrollbars/overlayscrollbars.css'

import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import { useEditLayoutAction, Workspace } from '~/features/workspace'
import { ActionMenu } from '~/ui/menu'
import { AddFolderButton } from './AddFolderButton'
import { FolderBrowser } from './FolderBrowser'
import { SearchInput } from './SearchInput'
import { Player } from './ServerMusicPlayer'
import { useServerAudioPlayer } from '../hooks'
import type { MusicFile } from '../types'

/**
 * The music page opens as the folder browser beside the player. Either can be
 * dragged under the other when a wide player suits the operator better.
 */
const MUSIC_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['browser'] },
    { id: 'col-2', panelIds: ['player'] },
  ],
}

// Comfortable reading width for the player column so its content never stretches
// too wide when the pane is dragged open. The page height is an extra upper bound
// (so the player is never taller than it is wide on short windows).
const PLAYER_MAX_WIDTH = 448

export function MusicPage() {
  const { t } = useTranslation('music')
  const { t: tCommon } = useTranslation('common')
  const player = useServerAudioPlayer()
  const [searchQuery, setSearchQuery] = useState('')
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Content row height, used as an upper bound for the player width on short
  // windows so it is never taller than it is wide.
  const [containerHeight, setContainerHeight] = useState<number>()

  const handlePlayTrack = useCallback(
    (track: MusicFile) => {
      player.playFile(track.id)
    },
    [player],
  )

  const handleAddToQueue = useCallback(
    (tracks: MusicFile | MusicFile[]) => {
      const trackArray = Array.isArray(tracks) ? tracks : [tracks]
      const fileIds = trackArray.map((track) => track.id)
      player.addToQueue(fileIds)
    },
    [player],
  )

  // Track the content row height so the player's max width can match it
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerHeight(el.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Below `lg` the panels stack in a fixed order instead of being rearrangeable.
  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024)
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const playerNode = (
    <Player
      state={player.state}
      currentTrack={player.currentTrack}
      onPlayPause={player.togglePlayPause}
      onPrevious={player.previous}
      onNext={player.next}
      onSeek={player.seek}
      onVolumeChange={player.setVolume}
      onToggleMute={player.toggleMute}
      onClearQueue={player.clearQueue}
      onPlayAtIndex={player.playAtIndex}
      onRemoveFromQueue={player.removeFromQueue}
      onToggleShuffle={player.toggleShuffle}
    />
  )

  // The player comes first here because that is the order the panels stack in
  // on a phone; on desktop the workspace layout decides where each one sits.
  const workspacePanels: WorkspacePanel[] = [
    {
      id: 'player',
      title: t('player.title'),
      render: () =>
        isLargeScreen ? (
          <div
            className="flex h-full flex-col overflow-hidden"
            style={{
              maxWidth: `${Math.min(containerHeight ?? PLAYER_MAX_WIDTH, PLAYER_MAX_WIDTH)}px`,
            }}
          >
            {playerNode}
          </div>
        ) : (
          <div className="flex w-full flex-col">{playerNode}</div>
        ),
    },
    {
      id: 'browser',
      title: t('folders.title'),
      render: () => (
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <div className="mb-4 w-full shrink-0">
            <SearchInput value={searchQuery} onChange={setSearchQuery} />
          </div>
          {isLargeScreen ? (
            <OverlayScrollbarsComponent
              className="flex-1"
              options={{
                scrollbars: { autoHide: 'scroll', autoHideDelay: 400 },
              }}
              defer
            >
              <FolderBrowser
                onPlayTrack={handlePlayTrack}
                onAddToQueue={handleAddToQueue}
                searchQuery={searchQuery}
              />
            </OverlayScrollbarsComponent>
          ) : (
            <FolderBrowser
              onPlayTrack={handlePlayTrack}
              onAddToQueue={handleAddToQueue}
              searchQuery={searchQuery}
            />
          )}
        </div>
      ),
    },
  ]

  const editLayoutAction = useEditLayoutAction('music')

  return (
    <div className="flex-1 flex flex-col overflow-x-hidden lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Music className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            {t('title')}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AddFolderButton />
          {/* Panels only form movable columns on a large screen. */}
          <ActionMenu
            items={isLargeScreen ? [editLayoutAction] : []}
            label={tCommon('actionsMenu.trigger')}
            triggerIcon={<MoreHorizontal size={16} />}
            testId="music-actions-menu"
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex flex-col lg:min-h-0">
        <Workspace
          id="music"
          panels={workspacePanels}
          defaultLayout={MUSIC_WORKSPACE_LAYOUT}
          defaultColumnSizes={['70%', '30%']}
          stacked={!isLargeScreen}
          className="flex-1 lg:min-h-0"
        />
      </div>
    </div>
  )
}
