import { FileUp, Info, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AISearchSettings } from '~/features/ai-search'
import { AlertModal } from '~/ui/modal'
import { BibleDownloadSection } from './BibleDownloadSection'
import { BibleTranslationsManager } from './BibleTranslationsManager'
import { useImportTranslation } from '../hooks'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

/**
 * Bible settings, rendered as a settings-page panel (extracted from the former
 * BibleSettingsModal). Hosts translation management, downloads, file import,
 * and AI search configuration. Keyboard shortcuts live in /settings/shortcuts.
 */
export function BibleSettingsPanel() {
  const { t } = useTranslation('bible')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const { mutateAsync: importTranslation, isPending: isImporting } =
    useImportTranslation()

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const suggestedName = file.name.replace(/\.xml$/i, '').replace(/-/g, ' ')

      await importTranslation({
        xmlContent: text,
        name: suggestedName,
        abbreviation: suggestedName.substring(0, 10).toUpperCase(),
        language: 'ro',
      })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('import.error'))
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className={cardClass}>
          <BibleTranslationsManager />
        </div>

        <div className={cardClass}>
          <BibleDownloadSection />
        </div>

        {/* Import from file */}
        <div className={cardClass}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <FileUp className="h-5 w-5" />
                {t('settings.import.title')}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('settings.import.description')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {t('settings.import.button')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Format instructions */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <p className="mb-2 font-medium text-blue-900 dark:text-blue-100">
                  {t('settings.import.formatTitle')}
                </p>
                <p className="mb-2 text-blue-800 dark:text-blue-200">
                  {t('settings.import.formatSimple')}
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  {t('settings.import.formatExamples')}{' '}
                  <a
                    href="https://github.com/radio-crestin/open-bibles"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    github.com/radio-crestin/open-bibles
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <AISearchSettings configKey="bible_ai_search_config" />
      </div>

      <AlertModal
        isOpen={!!importError}
        title={t('import.errorTitle')}
        message={importError || ''}
        onClose={() => setImportError(null)}
        variant="error"
      />
    </>
  )
}
