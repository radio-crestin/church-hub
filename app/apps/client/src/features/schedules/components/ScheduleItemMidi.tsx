import { Music } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { ScheduleMidiSyncModal } from './ScheduleMidiSyncModal'
import { useAnchoredPopover } from '../hooks/useAnchoredPopover'
import { useScheduleItemMidi } from '../hooks/useScheduleItemMidi'
import type { ScheduleItem } from '../types'
import { formatClock } from '../utils/formatClock'

interface ScheduleItemMidiProps {
  scheduleId: number
  item: ScheduleItem
}

const POPOVER_WIDTH = 280

/**
 * A song item's MIDI music, beside the item: attach a .mid file, sync its
 * verses by ear, or remove it. When the running presentation reaches the
 * item the music plays and each verse goes up at its time.
 */
export function ScheduleItemMidi({ scheduleId, item }: ScheduleItemMidiProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [syncing, setSyncing] = useState(false)
  const { buttonRef, popoverRef, anchor, open, close } =
    useAnchoredPopover(POPOVER_WIDTH)
  const { upload, remove, setVerseTimes } = useScheduleItemMidi(
    scheduleId,
    item.id,
  )
  const midi = item.midi

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      await upload.mutateAsync(file)
      showToast(t('midi.attached'), 'success')
    } catch {
      showToast(t('midi.notMidi'), 'error')
    }
  }

  const button =
    'rounded-lg px-2 py-1 text-[13px] text-fg-body hover:bg-hover disabled:opacity-50'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (anchor) close()
          else open()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title={t('midi.title')}
        data-testid="schedule-item-midi"
        data-attached={midi ? 'true' : undefined}
        className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs tabular-nums ${
          midi
            ? 'bg-selected text-fg hover:bg-hover'
            : 'text-fg-hint hover:bg-hover'
        }`}
      >
        <Music size={12} strokeWidth={2} />
        {midi ? formatClock(midi.durationSeconds) : t('midi.short')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".mid,.midi,.kar,audio/midi,audio/x-midi"
        className="hidden"
        data-testid="schedule-item-midi-file"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('midi.title')}
            data-testid="schedule-item-midi-popover"
            className="fixed z-50 rounded-[10px] border border-line bg-panel p-3 shadow-popover"
            style={{ left: anchor.x, top: anchor.y, width: POPOVER_WIDTH }}
            // React events bubble out of a portal to the item row.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="text-[13px] font-medium text-fg">{t('midi.title')}</p>
            <p className="mt-1 text-xs text-fg-hint">{t('midi.description')}</p>
            {midi && (
              <div className="mt-2 rounded-lg bg-field px-2 py-1.5 text-xs">
                <p
                  className="truncate font-medium tabular-nums text-fg-body"
                  data-testid="schedule-item-midi-name"
                >
                  {midi.fileName} · {formatClock(midi.durationSeconds)}
                </p>
                <p
                  className="text-fg-hint"
                  data-testid="schedule-item-midi-sync-state"
                  data-synced={midi.verseTimes ? 'true' : 'false'}
                >
                  {midi.verseTimes ? t('midi.synced') : t('midi.splitEvenly')}
                </p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-1">
              {midi && (
                <>
                  <button
                    type="button"
                    className={button}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate()}
                    data-testid="schedule-item-midi-remove"
                  >
                    {t('midi.remove')}
                  </button>
                  {midi.verseTimes && (
                    <button
                      type="button"
                      className={button}
                      disabled={setVerseTimes.isPending}
                      onClick={() => setVerseTimes.mutate(null)}
                      data-testid="schedule-item-midi-reset"
                    >
                      {t('midi.resetSync')}
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className={button}
                disabled={upload.isPending}
                onClick={() => fileRef.current?.click()}
                data-testid="schedule-item-midi-choose"
              >
                {midi ? t('midi.replace') : t('midi.choose')}
              </button>
              {midi && (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    setSyncing(true)
                  }}
                  data-testid="schedule-item-midi-sync"
                  className="rounded-lg bg-primary px-3 py-1 text-[13px] text-white hover:bg-indigo-700"
                >
                  {t('midi.sync')}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {syncing && midi && (
        <ScheduleMidiSyncModal
          scheduleId={scheduleId}
          item={{ ...item, midi }}
          onClose={() => setSyncing(false)}
        />
      )}
    </>
  )
}
