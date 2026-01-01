import { AlertCircle, Download, Globe, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getApiUrl } from '~/config'
import { Combobox } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useAvailableBibles, useImportTranslation } from '../hooks'

interface BibleDownloadSectionProps {
  portalContainer?: HTMLElement | null
}

export function BibleDownloadSection({
  portalContainer,
}: BibleDownloadSectionProps) {
  const { t } = useTranslation('bible')
  const { showToast } = useToast()
  const { mutateAsync: importTranslation, isPending } = useImportTranslation()
  const {
    data: biblesData,
    isLoading: isLoadingBibles,
    error: biblesError,
  } = useAvailableBibles()

  const [selectedBible, setSelectedBible] = useState<string>('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!selectedBible || !biblesData) return

    const bible = biblesData.bibles.find((b) => b.filename === selectedBible)
    if (!bible) return

    setIsDownloading(true)
    try {
      // Fetch the XML file through server-side proxy to avoid CORS
      const proxyUrl = `${getApiUrl()}/api/bible/download?url=${encodeURIComponent(bible.downloadUrl)}`
      const response = await fetch(proxyUrl, { credentials: 'include' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to download: ${response.statusText}`,
        )
      }

      const xmlContent = await response.text()

      // Extract abbreviation from filename (e.g., "EnglishKJV.xml" -> "ENGLISHKJV")
      const abbreviation = bible.filename
        .replace(/\.xml$/i, '')
        .substring(0, 15)
        .toUpperCase()

      // Import the translation with the detected language code
      await importTranslation({
        xmlContent,
        name: bible.name,
        abbreviation,
        language: bible.languageCode,
      })

      showToast(
        t('settings.download.success', {
          defaultValue: 'Bible downloaded and imported successfully!',
        }),
        'success',
      )
      setSelectedBible('')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t('settings.download.error', {
              defaultValue: 'Failed to download Bible',
            }),
        'error',
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const isLoading = isPending || isDownloading

  // Convert available Bibles to Combobox options
  // The name from the XML already includes language info (e.g., "Romani from Romanian (E Romaii Biblia 2020)")
  const bibleOptions = useMemo(() => {
    if (!biblesData) return []
    return biblesData.bibles.map((bible) => ({
      value: bible.filename,
      label: bible.name,
    }))
  }, [biblesData])

  const handleBibleSelect = (value: number | string | null) => {
    setSelectedBible(typeof value === 'string' ? value : '')
  }

  const selectedBibleInfo = biblesData?.bibles.find(
    (b) => b.filename === selectedBible,
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('settings.download.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('settings.download.description')}
            {biblesData && (
              <span className="ml-1 text-indigo-600 dark:text-indigo-400">
                ({biblesData.metadata.totalTranslations}{' '}
                {t('settings.download.translationsAvailable')})
              </span>
            )}
          </p>
        </div>
      </div>

      {biblesError ? (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{t('settings.download.fetchError')}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <div className="flex-1">
              <Combobox
                options={bibleOptions}
                value={selectedBible || null}
                onChange={handleBibleSelect}
                placeholder={
                  isLoadingBibles
                    ? t('settings.download.loading')
                    : t('settings.download.selectBible')
                }
                disabled={isLoading || isLoadingBibles}
                allowClear
                portalContainer={portalContainer}
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!selectedBible || isLoading || isLoadingBibles}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t('settings.download.button')}
            </button>
          </div>

          {selectedBibleInfo && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <p>
                {t('settings.download.willImport', {
                  defaultValue: 'Will import as:',
                })}{' '}
                {selectedBibleInfo.filename
                  .replace(/\.xml$/i, '')
                  .substring(0, 15)
                  .toUpperCase()}
                {selectedBibleInfo.languageCode &&
                  ` (${t('settings.download.language', { defaultValue: 'Language' })}: ${selectedBibleInfo.languageCode.toUpperCase()})`}
              </p>
              {selectedBibleInfo.copyright && (
                <p className="italic">{selectedBibleInfo.copyright}</p>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        {t('settings.download.source', { defaultValue: 'Source:' })}{' '}
        <a
          href="https://github.com/radio-crestin/Holy-Bible-XML-Format"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          github.com/radio-crestin/Holy-Bible-XML-Format
        </a>
      </p>
    </div>
  )
}
