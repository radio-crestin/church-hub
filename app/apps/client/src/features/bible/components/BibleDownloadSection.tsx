import { Download, Loader2, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useImportTranslation } from '../hooks'

interface BibleDownloadSectionProps {
  portalContainer?: HTMLElement | null
}

interface AvailableBible {
  filename: string
  name: string
  language: string
  abbreviation: string
  format: 'usfx' | 'osis' | 'zefania'
}

// Available Bibles from https://github.com/radio-crestin/open-bibles
const AVAILABLE_BIBLES: AvailableBible[] = [
  // OSIS Format
  { filename: 'eng-kjv.osis.xml', name: 'King James Version', language: 'en', abbreviation: 'KJV', format: 'osis' },
  { filename: 'deu-luther1912.osis.xml', name: 'Luther 1912', language: 'de', abbreviation: 'LUT1912', format: 'osis' },
  { filename: 'fra-ostervald.osis.xml', name: 'Ostervald', language: 'fr', abbreviation: 'OST', format: 'osis' },
  { filename: 'grc-septuagint.osis.xml', name: 'Septuagint', language: 'el', abbreviation: 'LXX', format: 'osis' },
  { filename: 'ita-diodati.osis.xml', name: 'Diodati', language: 'it', abbreviation: 'DIO', format: 'osis' },
  { filename: 'bul-bulgarian.osis.xml', name: 'Bulgarian Bible', language: 'bg', abbreviation: 'BUL', format: 'osis' },
  { filename: 'sqi-albanian.osis.xml', name: 'Albanian Bible', language: 'sq', abbreviation: 'ALB', format: 'osis' },
  { filename: 'ara-arabicsvd.osis.xml', name: 'Arabic SVD', language: 'ar', abbreviation: 'SVD', format: 'osis' },
  { filename: 'ces-kralicka.osis.xml', name: 'Bible Kralicka', language: 'cs', abbreviation: 'KRA', format: 'osis' },
  { filename: 'dan-danish.osis.xml', name: 'Danish Bible', language: 'da', abbreviation: 'DAN', format: 'osis' },
  { filename: 'ell-greek.osis.xml', name: 'Modern Greek', language: 'el', abbreviation: 'GRK', format: 'osis' },
  { filename: 'fin-finnish.osis.xml', name: 'Finnish Bible', language: 'fi', abbreviation: 'FIN', format: 'osis' },
  { filename: 'hun-karoli.osis.xml', name: 'Karoli', language: 'hu', abbreviation: 'KAR', format: 'osis' },
  { filename: 'ind-indonesian.osis.xml', name: 'Indonesian TB', language: 'id', abbreviation: 'INTB', format: 'osis' },
  { filename: 'jpn-japanese.osis.xml', name: 'Japanese Bible', language: 'ja', abbreviation: 'JPN', format: 'osis' },
  { filename: 'kor-korean.osis.xml', name: 'Korean Bible', language: 'ko', abbreviation: 'KOR', format: 'osis' },
  { filename: 'nld-statenvertaling.osis.xml', name: 'Statenvertaling', language: 'nl', abbreviation: 'STV', format: 'osis' },
  { filename: 'nor-norwegian.osis.xml', name: 'Norwegian Bible', language: 'no', abbreviation: 'NOR', format: 'osis' },
  { filename: 'pol-polish.osis.xml', name: 'Polish Bible', language: 'pl', abbreviation: 'POL', format: 'osis' },
  { filename: 'ron-cornilescu.osis.xml', name: 'Cornilescu', language: 'ro', abbreviation: 'CORN', format: 'osis' },
  { filename: 'swe-swedish.osis.xml', name: 'Swedish Bible', language: 'sv', abbreviation: 'SWE', format: 'osis' },
  { filename: 'tha-thai.osis.xml', name: 'Thai Bible', language: 'th', abbreviation: 'THA', format: 'osis' },
  { filename: 'tur-turkish.osis.xml', name: 'Turkish Bible', language: 'tr', abbreviation: 'TUR', format: 'osis' },

  // USFX Format
  { filename: 'chi-cuv.usfx.xml', name: 'Chinese Union Version', language: 'zh', abbreviation: 'CUV', format: 'usfx' },
  { filename: 'spa-rv1909.usfx.xml', name: 'Reina Valera 1909', language: 'es', abbreviation: 'RV1909', format: 'usfx' },
  { filename: 'por-almeida.usfx.xml', name: 'Almeida', language: 'pt', abbreviation: 'ALM', format: 'usfx' },
  { filename: 'heb-leningrad.usfx.xml', name: 'Leningrad Codex', language: 'he', abbreviation: 'WLC', format: 'usfx' },
  { filename: 'vie-vietnamese.usfx.xml', name: 'Vietnamese Bible', language: 'vi', abbreviation: 'VIE', format: 'usfx' },
  { filename: 'ukr-ukrainian.usfx.xml', name: 'Ukrainian Bible', language: 'uk', abbreviation: 'UKR', format: 'usfx' },
  { filename: 'hin-hindi.usfx.xml', name: 'Hindi Bible', language: 'hi', abbreviation: 'HIN', format: 'usfx' },
  { filename: 'ben-bengali.usfx.xml', name: 'Bengali Bible', language: 'bn', abbreviation: 'BEN', format: 'usfx' },
  { filename: 'tam-tamil.usfx.xml', name: 'Tamil Bible', language: 'ta', abbreviation: 'TAM', format: 'usfx' },
  { filename: 'tgl-tagalog.usfx.xml', name: 'Tagalog Bible', language: 'tl', abbreviation: 'TAG', format: 'usfx' },

  // Zefania Format
  { filename: 'rus-synodal.zefania.xml', name: 'Russian Synodal', language: 'ru', abbreviation: 'RSV', format: 'zefania' },
  { filename: 'cze-bkr.zefania.xml', name: 'Bible Kralicka', language: 'cs', abbreviation: 'BKR', format: 'zefania' },
  { filename: 'slk-seb.zefania.xml', name: 'Slovak Bible', language: 'sk', abbreviation: 'SEB', format: 'zefania' },
]

const BASE_URL = 'https://raw.githubusercontent.com/radio-crestin/open-bibles/refs/heads/master/'

export function BibleDownloadSection({ portalContainer }: BibleDownloadSectionProps) {
  const { t } = useTranslation('bible')
  const { showToast } = useToast()
  const { mutateAsync: importTranslation, isPending } = useImportTranslation()

  const [selectedBible, setSelectedBible] = useState<string>('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!selectedBible) return

    const bible = AVAILABLE_BIBLES.find((b) => b.filename === selectedBible)
    if (!bible) return

    setIsDownloading(true)
    try {
      // Fetch the XML file from GitHub
      const response = await fetch(`${BASE_URL}${bible.filename}`)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`)
      }

      const xmlContent = await response.text()

      // Import the translation
      await importTranslation({
        xmlContent,
        name: bible.name,
        abbreviation: bible.abbreviation,
        language: bible.language,
      })

      showToast(
        t('settings.download.success', { defaultValue: 'Bible downloaded and imported successfully!' }),
        'success'
      )
      setSelectedBible('')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('settings.download.error', { defaultValue: 'Failed to download Bible' }),
        'error'
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const isLoading = isPending || isDownloading
  const selectedBibleInfo = AVAILABLE_BIBLES.find((b) => b.filename === selectedBible)

  // Convert available Bibles to Combobox options
  const bibleOptions = useMemo(
    () =>
      AVAILABLE_BIBLES.map((bible) => ({
        value: bible.filename,
        label: `${bible.name} (${bible.language.toUpperCase()}) - ${bible.format.toUpperCase()}`,
      })),
    []
  )

  const handleBibleSelect = (value: number | string | null) => {
    setSelectedBible(typeof value === 'string' ? value : '')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('settings.download.title', { defaultValue: 'Download Bible' })}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('settings.download.description', { defaultValue: 'Download Bibles from the open-bibles repository' })}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Combobox
            options={bibleOptions}
            value={selectedBible || null}
            onChange={handleBibleSelect}
            placeholder={t('settings.download.selectBible', { defaultValue: 'Select a Bible to download...' })}
            disabled={isLoading}
            allowClear
            portalContainer={portalContainer}
          />
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!selectedBible || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {t('settings.download.button', { defaultValue: 'Download' })}
        </button>
      </div>

      {selectedBibleInfo && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {t('settings.download.willImport', { defaultValue: 'Will import as:' })} {selectedBibleInfo.abbreviation}
        </p>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        {t('settings.download.source', { defaultValue: 'Source:' })}{' '}
        <a
          href="https://github.com/radio-crestin/open-bibles"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          github.com/radio-crestin/open-bibles
        </a>
      </p>
    </div>
  )
}
