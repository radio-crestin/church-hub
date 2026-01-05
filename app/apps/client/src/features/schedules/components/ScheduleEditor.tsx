import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useUpsertSchedule } from '../hooks'

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
          className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('actions.back')}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={upsertSchedule.isPending || !title.trim()}
          className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {upsertSchedule.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{t('actions.save')}</span>
        </button>
      </div>

      {/* Title & Description */}
      <div className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('editor.title', 'Title')}
          </label>
          <input
            id="schedule-title"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('editor.titlePlaceholder')}
            className="w-full px-3 py-2 text-base font-semibold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-600 dark:text-gray-300 placeholder-gray-400 transition-colors"
          />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('editor.hint', 'Press Ctrl+Enter to save')}
        </p>
      </div>
    </div>
  )
}
