import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast/useToast'
import { SlideList } from './SlideList'
import { useProgram, useUpsertProgram } from '../hooks'
import type { UpsertProgramInput } from '../types'

interface ProgramEditorProps {
  programId: number | 'new'
}

export function ProgramEditor({ programId }: ProgramEditorProps) {
  const { t } = useTranslation('programs')
  const navigate = useNavigate()
  const { addToast } = useToast()
  const isNew = programId === 'new'

  const { data: program, isLoading } = useProgram(isNew ? 0 : programId)
  const upsertProgram = useUpsertProgram()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [_hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (program) {
      setName(program.name)
      setDescription(program.description || '')
    }
  }, [program])

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ type: 'error', message: t('messages.nameRequired') })
      return
    }

    const input: UpsertProgramInput = {
      name: name.trim(),
      description: description.trim() || null,
    }

    if (!isNew && typeof programId === 'number') {
      input.id = programId
    }

    try {
      const saved = await upsertProgram.mutateAsync(input)
      setHasChanges(false)
      addToast({ type: 'success', message: t('messages.saved') })

      if (isNew && saved?.id) {
        navigate({
          to: '/programs/$programId',
          params: { programId: String(saved.id) },
        })
      }
    } catch {
      addToast({ type: 'error', message: t('messages.saveFailed') })
    }
  }

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/programs"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? t('newProgram') : t('editProgram')}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={upsertProgram.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {upsertProgram.isPending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Save size={20} />
          )}
          {t('actions.save')}
        </button>
      </div>

      {/* Program Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('fields.name')}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setHasChanges(true)
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
              placeholder={t('placeholders.name')}
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('fields.description')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setHasChanges(true)
              }}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white resize-none"
              placeholder={t('placeholders.description')}
            />
          </div>
        </div>
      </div>

      {/* Slides Section - Only show for existing programs */}
      {!isNew && typeof programId === 'number' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('slides.title')}
            </h2>
          </div>
          <SlideList programId={programId} slides={program?.slides || []} />
        </div>
      )}

      {isNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t('messages.saveToAddSlides')}
          </p>
        </div>
      )}
    </div>
  )
}
