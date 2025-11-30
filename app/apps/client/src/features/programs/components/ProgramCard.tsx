import { Link } from '@tanstack/react-router'
import { Edit, MoreVertical, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Program } from '../types'

interface ProgramCardProps {
  program: Program
  onDelete: (program: Program) => void
  onPresent: (program: Program) => void
}

export function ProgramCard({
  program,
  onDelete,
  onPresent,
}: ProgramCardProps) {
  const { t } = useTranslation('programs')
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  return (
    <div className="relative border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
      <div className="flex items-start justify-between">
        <Link
          to="/programs/$programId"
          params={{ programId: String(program.id) }}
          className="flex-1 min-w-0"
        >
          <h3 className="text-base font-medium text-gray-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400">
            {program.name}
          </h3>
          {program.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {program.description}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('updatedAt', { date: formatDate(program.updatedAt) })}
          </p>
        </Link>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onPresent(program)}
            className="p-2 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
            title={t('actions.present')}
          >
            <Play size={18} />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical
                size={18}
                className="text-gray-500 dark:text-gray-400"
              />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  <Link
                    to="/programs/$programId"
                    params={{ programId: String(program.id) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Edit size={16} />
                    {t('actions.edit')}
                  </Link>
                  <div className="border-t border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={() => {
                      onDelete(program)
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                    {t('actions.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
