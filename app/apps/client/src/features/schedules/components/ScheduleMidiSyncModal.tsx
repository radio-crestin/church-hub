import { Loader2, Pause, Play, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import { useToast } from '~/ui/toast'
import { MidiSyncNowNext, type SyncVerse } from './MidiSyncNowNext'
import { MidiSyncTimeline } from './MidiSyncTimeline'
import { MidiSyncVerseRow } from './MidiSyncVerseRow'
import { useMidiSyncSession } from '../hooks/useMidiSyncSession'
import { useScheduleItemMidi } from '../hooks/useScheduleItemMidi'
import type { ScheduleItem, ScheduleItemMidi } from '../types'
import { midiVerseTimes } from '../utils/midiVerseTimes'

interface ScheduleMidiSyncModalProps {
  scheduleId: number
  item: ScheduleItem & { midi: ScheduleItemMidi }
  onClose: () => void
}

/** ← / → jump this far, like a player's skip. */
const SKIP_SECONDS = 3

/**
 * Syncs a song item's verses to its MIDI music, the way lyric-sync tools do
 * it: the music plays and each tap of "Next verse" (Space) marks where the
 * next verse starts. A tap can be undone (Backspace), any verse played again
 * from just before it and re-tapped, and any time nudged, so one wrong verse
 * never means playing the whole song again. It opens with the current times.
 */
export function ScheduleMidiSyncModal({
  scheduleId,
  item,
  onClose,
}: ScheduleMidiSyncModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { setVerseTimes } = useScheduleItemMidi(scheduleId, item.id)

  const verses: SyncVerse[] = useMemo(
    () =>
      expandSongSlidesWithChoruses(item.slides).map((slide) => ({
        label: slide.label ?? '',
        text: stripHtmlTags(slide.content),
      })),
    [item.slides],
  )
  const session = useMidiSyncSession({
    scheduleId,
    itemId: item.id,
    durationSeconds: item.midi.durationSeconds,
    initialTimes: midiVerseTimes(item),
    onSilent: () => showToast(t('midi.noAudio'), 'info'),
    onError: () => showToast(t('messages.error'), 'error'),
  })
  const allMarked = session.cursor >= verses.length

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const close = () => {
    session.stop()
    onClose()
  }

  const save = async () => {
    try {
      await setVerseTimes.mutateAsync(session.times)
      showToast(t('midi.syncSaved'), 'success')
      close()
    } catch {
      showToast(t('messages.error'), 'error')
    }
  }

  const sessionRef = useRef(session)
  sessionRef.current = session
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = sessionRef.current
      const key = e.key
      if (key === ' ' || key === 'Enter' || key === 'ArrowDown') {
        e.preventDefault()
        if (s.playing) s.mark()
        else void s.start()
      } else if (key === 'Backspace' || key === 'z' || key === 'Z') {
        e.preventDefault()
        s.undo()
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        s.seek(s.position + (key === 'ArrowLeft' ? -1 : 1) * SKIP_SECONDS)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col bg-panel p-0 shadow-popover backdrop:bg-black/50 sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-xl sm:border sm:border-line"
      // Escape pauses the music first; a second Escape closes.
      onCancel={(e) => {
        e.preventDefault()
        if (session.playing) session.pause()
        else close()
      }}
      onClick={(e) => e.stopPropagation()}
      data-testid="schedule-midi-sync-modal"
    >
      <div className="flex items-center gap-2 border-b border-line p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-fg">
            {t('midi.syncTitle')}
          </h2>
          <p className="truncate text-sm text-fg-hint">{item.song?.title}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={setVerseTimes.isPending}
          data-testid="schedule-midi-sync-save"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('midi.syncSave')}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label={t('modal.cancel')}
          className="rounded-lg p-2 text-fg-label hover:bg-hover hover:text-fg"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <MidiSyncNowNext verses={verses} current={session.current} />
        <MidiSyncTimeline
          times={session.times}
          position={session.position}
          durationSeconds={item.midi.durationSeconds}
          current={session.current}
          onSeek={session.seek}
        />
        <p className="text-sm text-fg-label">{t('midi.syncHelp')}</p>
        <ol className="space-y-0.5">
          {verses.map((verse, index) => (
            <MidiSyncVerseRow
              key={index}
              index={index}
              verse={verse}
              time={session.times[index] ?? 0}
              isCurrent={index === session.current}
              isNext={session.playing && index === session.cursor}
              onPlay={() => session.playVerse(index)}
              onNudge={(delta) => session.nudge(index, delta)}
            />
          ))}
        </ol>
      </div>

      <div className="border-t border-line p-3 sm:p-4">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={session.undo}
            disabled={!session.canUndo}
            title={t('midi.undo')}
            aria-label={t('midi.undo')}
            data-testid="schedule-midi-sync-undo"
            className="flex w-14 items-center justify-center rounded-lg text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-hover disabled:opacity-40"
          >
            <Undo2 size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={
              session.playing ? session.pause : () => void session.start()
            }
            disabled={session.starting}
            title={session.playing ? t('midi.pause') : t('midi.syncStart')}
            aria-label={session.playing ? t('midi.pause') : t('midi.syncStart')}
            data-testid="schedule-midi-sync-start"
            data-playing={session.playing ? 'true' : undefined}
            className="flex w-14 items-center justify-center rounded-lg text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-hover disabled:opacity-40"
          >
            {session.starting ? (
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
            ) : session.playing ? (
              <Pause size={20} strokeWidth={1.5} />
            ) : (
              <Play size={20} strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            // On press, not on release: a tap is timed to the music.
            onPointerDown={(e) => {
              e.preventDefault()
              session.mark()
            }}
            disabled={!session.playing || allMarked}
            data-testid="schedule-midi-sync-next"
            className="min-h-16 flex-1 rounded-lg bg-primary px-4 text-lg font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {allMarked && session.playing
              ? t('midi.allMarked')
              : t('midi.syncNext')}
          </button>
        </div>
        <p className="mt-2 hidden text-center text-xs text-fg-hint sm:block">
          {t('midi.keys')}
        </p>
      </div>
    </dialog>,
    document.body,
  )
}
