import { useCallback, useEffect, useRef, useState } from 'react'

import { playScheduleItemMidi, stopScheduleItemMidi } from '../service'
import { syncedVerseAt } from '../utils/syncedVerseAt'

/** Playback starts this long before a verse played "from here". */
const LEAD_IN_SECONDS = 3
/** A nudge moves a verse's time by this much. */
export const NUDGE_SECONDS = 0.5

interface Options {
  scheduleId: number
  itemId: number
  durationSeconds: number
  /** The times the dialog opens with (synced, else split evenly). */
  initialTimes: number[]
  /** No audio server: the clock still runs, the music is silent. */
  onSilent: () => void
  onError: () => void
}

const round = (seconds: number) => Math.round(seconds * 10) / 10

/**
 * One sync session of a song item's verses to its MIDI music, the way
 * lyric-sync tools work (ProPresenter's timeline, LRC editors, Musixmatch):
 * the music plays and each tap marks where the next verse starts; a tap can
 * be undone, any verse re-tapped from a little before it, and any time
 * nudged, without playing the whole song again. Verse 1 always starts at 0.
 */
export function useMidiSyncSession({
  scheduleId,
  itemId,
  durationSeconds,
  initialTimes,
  onSilent,
  onError,
}: Options) {
  const [times, setTimes] = useState<number[]>(initialTimes)
  /** The verse the next tap marks. */
  const [cursor, setCursor] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [position, setPosition] = useState(0)
  const [history, setHistory] = useState<{ index: number; time: number }[]>([])
  /** performance.now() at which playback would have been at 0 s. */
  const zeroAt = useRef(0)
  const verseCount = times.length

  const clock = useCallback(
    () => (performance.now() - zeroAt.current) / 1000,
    [],
  )

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const now = clock()
      if (now >= durationSeconds) {
        setPlaying(false)
        setPosition(durationSeconds)
        return
      }
      setPosition(now)
    }, 100)
    return () => clearInterval(timer)
  }, [playing, clock, durationSeconds])

  const playFrom = useCallback(
    async (seconds: number) => {
      const from = Math.max(0, Math.min(seconds, durationSeconds))
      setStarting(true)
      try {
        const audible = await playScheduleItemMidi(scheduleId, itemId, from)
        if (!audible) onSilent()
        zeroAt.current = performance.now() - from * 1000
        setPosition(from)
        setPlaying(true)
      } catch {
        onError()
      } finally {
        setStarting(false)
      }
    },
    [scheduleId, itemId, durationSeconds, onSilent, onError],
  )

  const pause = useCallback(() => {
    if (!playing) return
    setPosition(clock())
    setPlaying(false)
    stopScheduleItemMidi(scheduleId, itemId).catch(() => {})
  }, [playing, clock, scheduleId, itemId])

  /** Stops the music for good (the dialog closes). */
  const stop = useCallback(() => {
    setPlaying(false)
    stopScheduleItemMidi(scheduleId, itemId).catch(() => {})
  }, [scheduleId, itemId])

  /** Marks where the verse under the cursor starts: now. */
  const mark = useCallback(() => {
    if (!playing || cursor >= verseCount) return
    const time = round(clock())
    setHistory((previous) => [
      ...previous,
      { index: cursor, time: times[cursor] as number },
    ])
    setTimes((previous) =>
      previous.map((old, index) => {
        if (index === cursor) return time
        // Later verses that would now come before this one move up behind it.
        if (index > cursor && old <= time) return time
        return old
      }),
    )
    setCursor((index) => index + 1)
  }, [playing, cursor, verseCount, clock, times])

  /** Takes the last tap back and rewinds to just before it. */
  const undo = useCallback(() => {
    const last = history.at(-1)
    if (!last) return
    const tapped = times[last.index] as number
    setHistory((previous) => previous.slice(0, -1))
    setTimes((previous) =>
      previous.map((old, index) => (index === last.index ? last.time : old)),
    )
    setCursor(last.index)
    if (playing) void playFrom(tapped - LEAD_IN_SECONDS)
  }, [history, times, playing, playFrom])

  /** Plays from a little before a verse; the next tap re-marks it. */
  const playVerse = useCallback(
    (index: number) => {
      setCursor(Math.max(1, index))
      void playFrom((times[index] ?? 0) - LEAD_IN_SECONDS)
    },
    [times, playFrom],
  )

  /** Moves one verse's time, kept between its neighbours. */
  const nudge = useCallback(
    (index: number, delta: number) => {
      if (index === 0) return
      setTimes((previous) => {
        const low = (previous[index - 1] ?? 0) + 0.1
        const high = (previous[index + 1] ?? durationSeconds) - 0.1
        const time = round(
          Math.min(high, Math.max(low, (previous[index] ?? 0) + delta)),
        )
        return previous.map((old, i) => (i === index ? time : old))
      })
    },
    [durationSeconds],
  )

  const seek = useCallback(
    (seconds: number) => {
      if (playing) void playFrom(seconds)
      else setPosition(Math.max(0, Math.min(seconds, durationSeconds)))
    },
    [playing, playFrom, durationSeconds],
  )

  return {
    times,
    cursor,
    playing,
    starting,
    position,
    canUndo: history.length > 0,
    current: syncedVerseAt(times, position),
    start: () => playFrom(position >= durationSeconds ? 0 : position),
    pause,
    stop,
    mark,
    undo,
    playVerse,
    nudge,
    seek,
  }
}
