import { convertFileSrc } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { MusicFile, PlayerState, QueueItem } from '../types'
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
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: getStoredVolume(),
    isMuted: false,
    isShuffled: false,
  })
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)

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
      playNext()
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
  }, [])

  const loadTrack = useCallback(async (file: MusicFile) => {
    if (!audioRef.current) return

    try {
      const url = convertFileSrc(file.path)
      audioRef.current.src = url
      setState((prev) => ({
        ...prev,
        currentTrack: file,
        currentTime: 0,
        duration: file.duration ?? 0,
      }))
      await audioRef.current.play()
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Error logging for audio player debugging
      console.error('[AudioPlayer] Failed to load track:', error)
    }
  }, [])

  const play = useCallback(() => {
    audioRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
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

  const addToQueue = useCallback((file: MusicFile) => {
    const item: QueueItem = {
      id: `${file.id}-${Date.now()}`,
      file,
      addedAt: Date.now(),
    }
    setQueue((prev) => [...prev, item])
  }, [])

  const addMultipleToQueue = useCallback((files: MusicFile[]) => {
    const items: QueueItem[] = files.map((file) => ({
      id: `${file.id}-${Date.now()}-${Math.random()}`,
      file,
      addedAt: Date.now(),
    }))
    setQueue((prev) => [...prev, ...items])
  }, [])

  const removeFromQueue = useCallback((itemId: string) => {
    setQueue((prev) => {
      const index = prev.findIndex((item) => item.id === itemId)
      if (index === -1) return prev

      const newQueue = prev.filter((item) => item.id !== itemId)

      setCurrentIndex((prevIndex) => {
        if (index < prevIndex) return prevIndex - 1
        if (index === prevIndex && prevIndex >= newQueue.length) {
          return Math.max(0, newQueue.length - 1)
        }
        return prevIndex
      })

      return newQueue
    })
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setCurrentIndex(-1)
    setState((prev) => ({ ...prev, currentTrack: null, isPlaying: false }))
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  const reorderQueue = useCallback((newQueue: QueueItem[]) => {
    setQueue(newQueue)
  }, [])

  const playFromQueue = useCallback(
    (index: number) => {
      if (index >= 0 && index < queue.length) {
        setCurrentIndex(index)
        loadTrack(queue[index].file)
      }
    },
    [queue, loadTrack],
  )

  const playNext = useCallback(() => {
    if (queue.length === 0) return

    const nextIndex = currentIndex + 1
    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex)
      loadTrack(queue[nextIndex].file)
    } else {
      setState((prev) => ({ ...prev, isPlaying: false }))
    }
  }, [queue, currentIndex, loadTrack])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return

    if (state.currentTime > 3) {
      seek(0)
      return
    }

    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex)
      loadTrack(queue[prevIndex].file)
    } else {
      seek(0)
    }
  }, [queue, currentIndex, state.currentTime, loadTrack, seek])

  const shuffleQueue = useCallback(() => {
    if (queue.length <= 1) return

    const currentItem = currentIndex >= 0 ? queue[currentIndex] : null
    const otherItems = queue.filter((_, i) => i !== currentIndex)
    const shuffled = shuffleArray(otherItems)

    if (currentItem) {
      setQueue([currentItem, ...shuffled])
      setCurrentIndex(0)
    } else {
      setQueue(shuffleArray(queue))
    }

    setState((prev) => ({ ...prev, isShuffled: true }))
  }, [queue, currentIndex])

  const playFile = useCallback(
    (file: MusicFile) => {
      const item: QueueItem = {
        id: `${file.id}-${Date.now()}`,
        file,
        addedAt: Date.now(),
      }
      setQueue([item])
      setCurrentIndex(0)
      loadTrack(file)
    },
    [loadTrack],
  )

  return {
    ...state,
    queue,
    currentIndex,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    loadTrack,
    playFile,
    addToQueue,
    addMultipleToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    playFromQueue,
    playNext,
    playPrevious,
    shuffleQueue,
  }
}
