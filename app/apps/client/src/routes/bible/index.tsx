import { createFileRoute } from '@tanstack/react-router'
import { Book, FileUp, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BibleSearchResult, BibleVerse } from '~/features/bible'
import {
  BibleSearch,
  useImportTranslation,
  useTranslations,
} from '~/features/bible'
import { AlertModal } from '~/ui/modal'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/bible/')({
  component: BiblePage,
})

function BiblePage() {
  const { t } = useTranslation('bible')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: translations, isLoading: translationsLoading } =
    useTranslations()
  const { mutateAsync: importTranslation, isPending: isImporting } =
    useImportTranslation()

  const [importError, setImportError] = useState<string | null>(null)

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()

      // Extract suggested name from filename (remove .xml extension)
      const suggestedName = file.name.replace(/\.xml$/i, '').replace(/-/g, ' ')

      await importTranslation({
        xmlContent: text,
        name: suggestedName,
        abbreviation: suggestedName.substring(0, 10).toUpperCase(),
        language: 'ro', // Default to Romanian, could prompt user
      })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('import.error'))
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePresentNow = (verse: BibleVerse | BibleSearchResult) => {
    // TODO: Implement present now functionality
    // biome-ignore lint/suspicious/noConsole: debugging
    console.log('[bible] Present now:', verse)
  }

  const handleAddToQueue = (verse: BibleVerse | BibleSearchResult) => {
    // TODO: Implement add to queue functionality
    // biome-ignore lint/suspicious/noConsole: debugging
    console.log('[bible] Add to queue:', verse)
  }

  return (
    <PagePermissionGuard permission="bible.view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Book className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileUp className="w-5 h-5" />
            )}
            {t('actions.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {translationsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        ) : translations && translations.length > 0 ? (
          <BibleSearch
            onPresentNow={handlePresentNow}
            onAddToQueue={handleAddToQueue}
          />
        ) : (
          <div className="text-center py-12">
            <Book className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('empty.title')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('empty.description')}
            </p>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={isImporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileUp className="w-5 h-5" />
              )}
              {t('actions.importFirst')}
            </button>
          </div>
        )}

        <AlertModal
          isOpen={!!importError}
          title={t('import.errorTitle')}
          message={importError || ''}
          onClose={() => setImportError(null)}
          variant="error"
        />
      </div>
    </PagePermissionGuard>
  )
}
