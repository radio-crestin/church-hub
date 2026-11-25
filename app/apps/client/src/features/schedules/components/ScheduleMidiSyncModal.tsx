import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useToast } from '~/ui/toast'
import { useScheduleItemMidi } from '../hooks/useScheduleItemMidi'
import { playScheduleItemMidi, stopScheduleItemMidi } from '../service'
import type { ScheduleItem } from '../types'
import { formatClock } from '../utils/formatClock'

interface ScheduleMidiSyncModalProps {
  scheduleId: number
  item: ScheduleItem
  onClose: () => void
}

type Phase = 'ready' | 'starting' | 'tapping' | 'done'

/**
 * Syncs a song item's verses to its MIDI music by ear: the music plays, the
 * first verse is up from the start, and each tap of "Next verse" (or Space)
 * marks where the next one begins. Saved, the running presentation puts
 * each verse up at its time.
 */
export function ScheduleMidiSyncModal({
  scheduleId,
  item,
  onClose,
}: ScheduleMidiSyncModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const startedAt = useRef(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [times, setTimes] = useState<number[]>([])
  const [elapsed, setElapsed] = useState(0)
  const { setVerseTimes } = useScheduleItemMidi(scheduleId, item.id)
  const slides = expandSongSlidesWithChoruses(item.slides)
  const current = times.length - 1

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    if (phase !== 'tapping') return
    const timer = setInterval(
      () => setElapsed((performance.now() - startedAt.current) / 1000),
      100,
    )
    return () => clearInterval(timer)
  }, [phase])

  const stop = useCallback(() => {
    stopScheduleItemMidi(scheduleId, item.id).catch(() => {})
  }, [scheduleId, item.id])

  const close = useCallback(() => {
    if (phase === 'tapping' || phase === 'done') stop()
    onClose()
  }, [phase, stop, onClose])

  const start = async () => {
    setPhase('starting')
    try {
      const audible = await playScheduleItemMidi(scheduleId, item.id)
      if (!audible) showToast(t('midi.noAudio'), 'info')
      startedAt.current = performance.now()
      setElapsed(0)
      setTimes([0])
      setPhase(slides.length > 1 ? 'tapping' : 'done')
    } catch {
      showToast(t('messages.error'), 'error')
      setPhase('ready')
    }
  }

  const tap = useCallback(() => {
    if (phase !== 'tapping') return
    const seconds =
      Math.round((performance.now() - startedAt.current) / 100) / 10
    setTimes((previous) => {
      const next = [...previous, seconds]
      if (next.length >= slides.length) setPhase('done')
      return next
    })
  }, [phase, slides.length])

  useEffect(() => {
    if (phase !== 'tapping') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      tap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, tap])

  const save = async () => {
    try {
      await setVerseTimes.mutateAsync(times)
      showToast(t('midi.syncSaved'), 'success')
      close()
    } catch {
      showToast(t('messages.error'), 'error')
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg flex-col p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.stopPropagation()}
      data-testid="schedule-midi-sync-modal"
    >
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('midi.syncTitle')}
          </h2>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {item.song?.title}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t('modal.cancel')}
          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('midi.syncHelp')}
        </p>
        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {slides.map((slide, index) => (
            <li
              key={`${slide.id}-${slide.displayIndex}`}
              data-testid="schedule-midi-sync-slide"
              data-current={index === current ? 'true' : undefined}
              className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-sm ${
                index === current
                  ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="w-10 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {slide.label ?? index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {slide.content.split('\n')[0]}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {times[index] !== undefined ? formatClock(times[index]) : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
        <span
          className="text-sm tabular-nums text-gray-500 dark:text-gray-400"
          data-testid="schedule-midi-sync-clock"
        >
          {phase === 'tapping' &&
            `${formatClock(elapsed)} / ${formatClock(item.midi?.durationSeconds ?? 0)}`}
        </span>
        <div className="flex gap-2">
          {(phase === 'ready' || phase === 'starting') && (
            <button
              type="button"
              onClick={start}
              disabled={phase === 'starting'}
              data-testid="schedule-midi-sync-start"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {phase === 'starting' && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {t('midi.syncStart')}
            </button>
          )}
          {phase === 'tapping' && (
            <button
              type="button"
              onClick={tap}
              data-testid="schedule-midi-sync-next"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700"
            >
              {t('midi.syncNext')}
            </button>
          )}
          {phase === 'done' && (
            <>
              <button
                type="button"
                onClick={() => {
                  stop()
                  setTimes([])
                  setPhase('ready')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                data-testid="schedule-midi-sync-again"
              >
                {t('midi.syncAgain')}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={setVerseTimes.isPending}
                data-testid="schedule-midi-sync-save"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('midi.syncSave')}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
