import { GripVertical, Music } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import 'overlayscrollbars/overlayscrollbars.css'

import { AddFolderButton } from './AddFolderButton'
import { FolderBrowser } from './FolderBrowser'
import { SearchInput } from './SearchInput'
import { Player } from './ServerMusicPlayer'
import { useServerAudioPlayer } from '../hooks'
import type { MusicFile } from '../types'

const MUSIC_DIVIDER_STORAGE_KEY = 'music-divider-position'
const DEFAULT_DIVIDER_POSITION = 70 // 70% left, 30% right

export function MusicPage() {
  const { t } = useTranslation('music')
  const player = useServerAudioPlayer()
  const [searchQuery, setSearchQuery] = useState('')
  const [dividerPosition, setDividerPosition] = useState(() => {
    const stored = localStorage.getItem(MUSIC_DIVIDER_STORAGE_KEY)
    return stored ? Number(stored) : DEFAULT_DIVIDER_POSITION
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

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

  // Persist divider position to localStorage
  useEffect(() => {
    localStorage.setItem(MUSIC_DIVIDER_STORAGE_KEY, String(dividerPosition))
  }, [dividerPosition])

  // Divider drag handler
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newPosition =
        ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100
      // Clamp between 40% and 85%
      setDividerPosition(Math.min(85, Math.max(40, newPosition)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-x-hidden lg:min-h-0 lg:overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Music className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            {t('title')}
          </h1>
        </div>
        <AddFolderButton />
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex flex-col lg:flex-row lg:min-h-0 gap-4 lg:gap-1"
      >
        {/* Mobile Player - Top on mobile, hidden on desktop */}
        <div className="flex flex-col w-full lg:hidden flex-shrink-0">
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
        </div>

        {/* Mobile Folder Browser - Full width on mobile, scrolls with page */}
        <div className="flex flex-col w-full lg:hidden">
          <div className="mb-4 w-full">
            <SearchInput value={searchQuery} onChange={setSearchQuery} />
          </div>
          <FolderBrowser
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            searchQuery={searchQuery}
          />
        </div>

        {/* Desktop Folder Browser - Resizable width on desktop */}
        <div
          className="hidden lg:flex flex-col min-w-0 overflow-hidden"
          style={{ width: `calc(${dividerPosition}% - 8px)` }}
        >
          <div className="flex-shrink-0 mb-4">
            <SearchInput value={searchQuery} onChange={setSearchQuery} />
          </div>
          <OverlayScrollbarsComponent
            className="flex-1"
            options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
            defer
          >
            <FolderBrowser
              onPlayTrack={handlePlayTrack}
              onAddToQueue={handleAddToQueue}
              searchQuery={searchQuery}
            />
          </OverlayScrollbarsComponent>
        </div>

        {/* Draggable Divider */}
        <div
          className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
          onMouseDown={handleDividerMouseDown}
        >
          <GripVertical
            size={16}
            className="text-gray-400 group-hover:text-indigo-500 transition-colors"
          />
        </div>

        {/* Desktop Player - Hidden on mobile, shown on desktop */}
        <div
          className="hidden lg:flex lg:flex-col overflow-hidden"
          style={{ width: `calc(${100 - dividerPosition}% - 8px)` }}
        >
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
        </div>
      </div>
    </div>
  )
}
