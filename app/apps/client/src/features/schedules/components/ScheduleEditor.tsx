import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { TodayProgramButton } from './TodayProgramButton'
import { useCreateTodayProgram, useUpsertSchedule } from '../hooks'

interface ScheduleEditorProps {
  scheduleId: null // Only for new schedules
  onBack: () => void
  onScheduleCreated?: (newId: number) => void
}

export function ScheduleEditor({
  onBack,
  onScheduleCreated,
}: ScheduleEditorProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()

  const upsertSchedule = useUpsertSchedule()
  const todayProgram = useCreateTodayProgram()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const titleInputRef = useRef<HTMLInputElement>(null)

  // Focus title input on mount
  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const handleSave = async () => {
    if (!title.trim()) {
      showToast(t('messages.titleRequired'), 'error')
      return
    }

    const result = await upsertSchedule.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
    })

    if (result.success && result.data) {
      showToast(t('messages.saved'), 'success')
      onScheduleCreated?.(result.data.id)
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleToday = async () => {
    const todayId = await todayProgram.createTodayProgram()
    if (todayId === null) {
      showToast(t('messages.error'), 'error')
      return
    }
    showToast(t('messages.saved'), 'success')
    onScheduleCreated?.(todayId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-[13px] bg-field hover:bg-selected text-fg-body rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">{t('actions.back')}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={upsertSchedule.isPending || !title.trim()}
          className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {upsertSchedule.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Save className="w-4 h-4" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline">{t('actions.save')}</span>
        </button>
      </div>

      {/* Title & Description */}
      <div className="space-y-4 p-4 bg-panel rounded-xl border border-line">
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-title"
            className="block text-[13px] font-medium text-fg-body"
          >
            {t('editor.title', 'Title')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="schedule-title"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('editor.titlePlaceholder')}
              className="flex-1 min-w-0 px-3 py-2 text-base font-semibold bg-field border border-transparent rounded-[10px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus text-fg placeholder:text-fg-hint transition-colors"
            />
            <TodayProgramButton
              onClick={handleToday}
              disabled={upsertSchedule.isPending}
              isPending={todayProgram.isPending}
              testId="schedule-editor-today"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-description"
            className="block text-[13px] font-medium text-fg-body"
          >
            {t('editor.description', 'Description')}
          </label>
          <textarea
            id="schedule-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('editor.descriptionPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 bg-field border border-transparent rounded-[10px] resize-none focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus text-fg-label placeholder:text-fg-hint transition-colors"
          />
        </div>

        <p className="text-xs text-fg-hint">
          {t('editor.hint', 'Press Ctrl+Enter to save')}
        </p>
      </div>
    </div>
  )
}
