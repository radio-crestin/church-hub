import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { TodayProgramButton } from './TodayProgramButton'
import { useCreateTodayProgram, useUpsertSchedule } from '../hooks'

interface CreateScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the new (or, for "Today", the existing) program's id. */
  onCreated: (scheduleId: number) => void
}

/** Names a new program, or makes today's in one click. */
export function CreateScheduleModal({
  isOpen,
  onClose,
  onCreated,
}: CreateScheduleModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const upsertSchedule = useUpsertSchedule()
  const today = useCreateTodayProgram()
  const isPending = upsertSchedule.isPending || today.isPending

  useEffect(() => {
    if (!isOpen) {
      dialogRef.current?.close()
      return
    }
    setTitle('')
    dialogRef.current?.showModal()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!isPending) onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, isPending])

  const finish = (scheduleId: number | null) => {
    if (scheduleId === null) {
      showToast(t('messages.error'), 'error')
      return
    }
    showToast(t('messages.saved'), 'success')
    onCreated(scheduleId)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || isPending) return
    const result = await upsertSchedule.mutateAsync({ title: trimmedTitle })
    finish(result.success && result.data ? result.data.id : null)
  }

  const handleToday = async () => {
    finish(await today.createTodayProgram())
  }

  const handleClose = () => {
    if (!isPending) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm p-0 bg-panel rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
      data-testid="create-schedule-modal"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-base font-semibold text-fg">
            {t('modal.createTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            aria-label={t('modal.cancel')}
            className="p-1 rounded hover:bg-hover disabled:opacity-50"
          >
            <X size={20} className="text-fg-hint" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4">
          <label
            htmlFor="create-schedule-title"
            className="block text-sm font-medium text-fg-body mb-2"
          >
            {t('modal.scheduleName')}
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id="create-schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              placeholder={t('editor.titlePlaceholder')}
              data-testid="create-schedule-input"
              className="flex-1 min-w-0 px-3 py-2 bg-field border border-transparent rounded-[10px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus text-fg disabled:opacity-50"
              autoComplete="off"
            />
            <TodayProgramButton
              onClick={handleToday}
              disabled={isPending}
              isPending={today.isPending}
              testId="create-schedule-today"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-line">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="h-9 px-3.5 text-sm font-medium text-fg-body hover:bg-hover rounded-lg transition-colors disabled:opacity-50"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isPending}
            data-testid="create-schedule-save"
            className="inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {upsertSchedule.isPending && (
              <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
            )}
            {t('modal.create')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
