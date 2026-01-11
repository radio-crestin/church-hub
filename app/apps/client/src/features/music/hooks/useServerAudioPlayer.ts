import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useWebSocket } from '~/features/presentation/hooks/useWebSocket'
import type { ServerPlayerState } from '../types'

const VOLUME_STORAGE_KEY = 'music-player-volume'

function storeVolume(volume: number): void {
  localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
}

const defaultState: ServerPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0,
  isMuted: false,
  isShuffled: false,
  currentIndex: -1,
  queueLength: 0,
  currentTrack: null,
  queue: [],
  updatedAt: 0,
}

export function useServerAudioPlayer() {
  const { send, status } = useWebSocket()

  const { data: state } = useQuery<ServerPlayerState>({
    queryKey: ['music', 'playerState'],
    queryFn: () => defaultState,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const play = useCallback(() => {
    send({ type: 'music_play' })
  }, [send])

  const pause = useCallback(() => {
    send({ type: 'music_pause' })
  }, [send])

  const togglePlayPause = useCallback(() => {
    if (state?.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state?.isPlaying, play, pause])

  const stop = useCallback(() => {
    send({ type: 'music_stop' })
  }, [send])

  const seek = useCallback(
    (time: number) => {
      send({ type: 'music_seek', payload: { time } })
    },
    [send],
  )

  const setVolume = useCallback(
    (volume: number) => {
      const level = Math.round(volume * 100)
      send({ type: 'music_volume', payload: { level } })
      storeVolume(volume)
    },
    [send],
  )

  const toggleMute = useCallback(() => {
    const newMuted = !state?.isMuted
    send({ type: 'music_mute', payload: { muted: newMuted } })
  }, [send, state?.isMuted])

  const next = useCallback(() => {
    send({ type: 'music_next' })
  }, [send])

  const previous = useCallback(() => {
    send({ type: 'music_previous' })
  }, [send])

  const playAtIndex = useCallback(
    (index: number) => {
      send({ type: 'music_play_index', payload: { index } })
    },
    [send],
  )

  const playFile = useCallback(
    (fileId: number) => {
      send({ type: 'music_play_file', payload: { fileId } })
    },
    [send],
  )

  const addToQueue = useCallback(
    (fileIds: number | number[]) => {
      const ids = Array.isArray(fileIds) ? fileIds : [fileIds]
      send({ type: 'music_add_to_queue', payload: { fileIds: ids } })
    },
    [send],
  )

  const removeFromQueue = useCallback(
    (itemId: number) => {
      send({ type: 'music_remove_from_queue', payload: { itemId } })
    },
    [send],
  )

  const clearQueue = useCallback(() => {
    send({ type: 'music_clear_queue' })
  }, [send])

  const setQueue = useCallback(
    (fileIds: number[]) => {
      send({ type: 'music_set_queue', payload: { fileIds } })
    },
    [send],
  )

  const reorderQueue = useCallback(
    (itemIds: number[]) => {
      send({ type: 'music_reorder_queue', payload: { itemIds } })
    },
    [send],
  )

  const toggleShuffle = useCallback(() => {
    const newShuffled = !state?.isShuffled
    send({ type: 'music_shuffle', payload: { enabled: newShuffled } })
  }, [send, state?.isShuffled])

  const currentTrack = state?.currentTrack
    ? {
        queueId: String(state.currentTrack.id),
        fileId: state.currentTrack.fileId,
        path: state.currentTrack.path,
        filename: state.currentTrack.filename,
        title: state.currentTrack.title,
        artist: state.currentTrack.artist,
        album: state.currentTrack.album,
        duration: state.currentTrack.duration,
      }
    : null

  return {
    state: state ?? defaultState,
    currentTrack,
    isConnected: status === 'connected',
    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    setVolume,
    toggleMute,
    next,
    previous,
    playAtIndex,
    playFile,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setQueue,
    reorderQueue,
    toggleShuffle,
  }
}
