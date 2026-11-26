import { FileUp, Info, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AISearchSettings } from '~/features/ai-search'
import { AlertModal } from '~/ui/modal'
import { SectionHeader } from '~/ui/page'
import { AutoPresentSettings } from './AutoPresentSettings'
import { BibleDownloadSection } from './BibleDownloadSection'
import { BibleTranslationsManager } from './BibleTranslationsManager'
import { ReadingSpeedSettings } from './ReadingSpeedSettings'
import { useImportTranslation } from '../hooks'

const cardClass = 'rounded-xl border border-line bg-panel p-4 sm:p-6'

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
          <SectionHeader
            title={t('settings.import.title')}
            description={t('settings.import.description')}
            icon={FileUp}
            actions={
              <button
                type="button"
                onClick={handleImportClick}
                disabled={isImporting}
                className="flex items-center gap-2 rounded-lg bg-primary h-9 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-line-strong"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <FileUp className="h-4 w-4" strokeWidth={1.5} />
                )}
                {t('settings.import.button')}
              </button>
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Format instructions */}
          <div className="rounded-lg border border-line-strong bg-selected p-4">
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg"
                strokeWidth={1.5}
              />
              <div className="text-sm">
                <p className="mb-2 font-medium text-fg">
                  {t('settings.import.formatTitle')}
                </p>
                <p className="mb-2 text-fg">
                  {t('settings.import.formatSimple')}
                </p>
                <p className="text-fg">
                  {t('settings.import.formatExamples')}{' '}
                  <a
                    href="https://github.com/radio-crestin/open-bibles"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-fg"
                  >
                    github.com/radio-crestin/open-bibles
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <AutoPresentSettings />
        </div>

        <div className={cardClass}>
          <ReadingSpeedSettings />
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
