import { Check, Copy, Globe, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'

import { getApiUrl } from '~/config'
import { LANGUAGES, type TranslationTarget } from '../hooks/useLiveTranslation'

interface PersistedSettingsSubset {
  targets?: TranslationTarget[]
}

export function LiveTranslationStreamsCard() {
  const { t } = useTranslation('liveTranslation')
  const [streamSecret, setStreamSecret] = useState<string>('')
  const [targets, setTargets] = useState<TranslationTarget[]>([])
  const [copied, setCopied] = useState(false)
  const baseUrl = getApiUrl() || ''

  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/stream-secret`)
      .then((r) => r.json())
      .then((d: { secret: string }) => setStreamSecret(d.secret))
      .catch(() => {})
  }, [baseUrl])

  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/settings`)
      .then((r) => r.json())
      .then((d: PersistedSettingsSubset) => {
        setTargets(Array.isArray(d.targets) ? d.targets : [])
      })
      .catch(() => {})
  }, [baseUrl])

  const streamUrl = useMemo(
    () =>
      streamSecret
        ? `https://churchub-backend.radiocrestin.ro/listen/${streamSecret}`
        : '',
    [streamSecret],
  )

  const langName = (code: string) =>
    LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase()

  const copy = () => {
    if (!streamUrl) return
    navigator.clipboard.writeText(streamUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 col-span-1 md:col-span-2 lg:col-span-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('dashboard.cardTitle')}
          </h3>
        </div>
        <Link
          to="/live-translation"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {t('dashboard.openSettings')}
        </Link>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('dashboard.cardDescription')}
      </p>

      {streamUrl && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={streamUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg font-mono select-all"
          />
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? t('settings.copiedUrl') : t('settings.copyUrl')}
          </button>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          {t('dashboard.configuredLanguages')}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.noLanguages')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {targets.map((tgt) => (
              <span
                key={tgt.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
              >
                <span className="font-semibold">
                  {tgt.targetLanguage.toUpperCase()}
                </span>
                <span className="text-blue-600/70 dark:text-blue-400/70">
                  {langName(tgt.targetLanguage)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
