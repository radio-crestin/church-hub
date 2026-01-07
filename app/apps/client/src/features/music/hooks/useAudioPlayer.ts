import { convertFileSrc } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { PlayerState, QueueItem } from '../types'
import { shuffleArray } from '../utils'

const VOLUME_STORAGE_KEY = 'music-player-volume'

function getStoredVolume(): number {
  const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
  return stored ? parseFloat(stored) : 0.8
}

function storeVolume(volume: number): void {
  localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: getStoredVolume(),
    isMuted: false,
    isShuffled: false,
    currentIndex: -1,
  })
  const [queue, setQueue] = useState<QueueItem[]>([])

  const currentTrack =
    state.currentIndex >= 0 ? queue[state.currentIndex] : null

  useEffect(() => {
    const audio = new Audio()
    audio.volume = state.volume
    audioRef.current = audio

    const handleTimeUpdate = () => {
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }))
    }

    const handleLoadedMetadata = () => {
      setState((prev) => ({ ...prev, duration: audio.duration }))
    }

    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false }))
    }

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true }))
    }

    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }))
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.pause()
      audio.src = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAndPlayTrack = useCallback(async (item: QueueItem) => {
    if (!audioRef.current) return

    try {
      const url = convertFileSrc(item.path)
      audioRef.current.src = url
      setState((prev) => ({
        ...prev,
        currentTime: 0,
        duration: item.duration ?? 0,
      }))
      await audioRef.current.play()
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Error logging for audio player debugging
      console.error('[AudioPlayer] Failed to load track:', error)
    }
  }, [])

  const play = useCallback(() => {
    if (audioRef.current && queue.length > 0) {
      if (state.currentIndex === -1) {
        setState((prev) => ({ ...prev, currentIndex: 0 }))
        loadAndPlayTrack(queue[0])
      } else {
        audioRef.current.play()
      }
    }
  }, [queue, state.currentIndex, loadAndPlayTrack])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state.isPlaying, play, pause])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setState((prev) => ({ ...prev, currentTime: time }))
    }
  }, [])

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    if (audioRef.current) {
      audioRef.current.volume = clamped
    }
    setState((prev) => ({ ...prev, volume: clamped, isMuted: false }))
    storeVolume(clamped)
  }, [])

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const newMuted = !state.isMuted
      audioRef.current.muted = newMuted
      setState((prev) => ({ ...prev, isMuted: newMuted }))
    }
  }, [state.isMuted])

  const addToQueue = useCallback((item: QueueItem) => {
    setQueue((prev) => [...prev, item])
  }, [])

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev

      const newQueue = prev.filter((_, i) => i !== index)

      setState((prevState) => {
        let newIndex = prevState.currentIndex
        if (index < prevState.currentIndex) {
          newIndex = prevState.currentIndex - 1
        } else if (index === prevState.currentIndex) {
          if (newQueue.length === 0) {
            newIndex = -1
          } else if (index >= newQueue.length) {
            newIndex = newQueue.length - 1
          }
        }
        return { ...prevState, currentIndex: newIndex }
      })

      return newQueue
    })
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setState((prev) => ({
      ...prev,
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }))
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  const reorderQueue = useCallback((newQueue: QueueItem[]) => {
    setQueue(newQueue)
  }, [])

  const playAtIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < queue.length) {
        setState((prev) => ({ ...prev, currentIndex: index }))
        loadAndPlayTrack(queue[index])
      }
    },
    [queue, loadAndPlayTrack],
  )

  const next = useCallback(() => {
    if (queue.length === 0) return

    const nextIndex = state.currentIndex + 1
    if (nextIndex < queue.length) {
      setState((prev) => ({ ...prev, currentIndex: nextIndex }))
      loadAndPlayTrack(queue[nextIndex])
    } else {
      setState((prev) => ({ ...prev, isPlaying: false }))
    }
  }, [queue, state.currentIndex, loadAndPlayTrack])

  const previous = useCallback(() => {
    if (queue.length === 0) return

    if (state.currentTime > 3) {
      seek(0)
      return
    }

    const prevIndex = state.currentIndex - 1
    if (prevIndex >= 0) {
      setState((prev) => ({ ...prev, currentIndex: prevIndex }))
      loadAndPlayTrack(queue[prevIndex])
    } else {
      seek(0)
    }
  }, [queue, state.currentIndex, state.currentTime, loadAndPlayTrack, seek])

  const shuffle = useCallback(() => {
    if (queue.length <= 1) return

    const currentItem =
      state.currentIndex >= 0 ? queue[state.currentIndex] : null
    const otherItems = queue.filter((_, i) => i !== state.currentIndex)
    const shuffled = shuffleArray(otherItems)

    if (currentItem) {
      setQueue([currentItem, ...shuffled])
      setState((prev) => ({ ...prev, currentIndex: 0, isShuffled: true }))
    } else {
      setQueue(shuffleArray(queue))
      setState((prev) => ({ ...prev, isShuffled: true }))
    }
  }, [queue, state.currentIndex])

  return {
    state,
    queue,
    currentTrack,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    playAtIndex,
    next,
    previous,
    shuffle,
  }
}
