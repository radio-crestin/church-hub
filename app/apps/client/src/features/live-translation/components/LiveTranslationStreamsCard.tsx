import { Link } from '@tanstack/react-router'
import { Check, Copy, Globe, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
    <div className="bg-panel rounded-xl p-6 border border-line col-span-1 md:col-span-2 lg:col-span-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-fg-label" strokeWidth={1.5} />
          <h3 className="text-base font-semibold text-fg">
            {t('dashboard.cardTitle')}
          </h3>
        </div>
        <Link
          to="/live-translation"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-field hover:bg-hover text-fg-body rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
          {t('dashboard.openSettings')}
        </Link>
      </div>

      <p className="text-sm text-fg-label mb-4">
        {t('dashboard.cardDescription')}
      </p>

      {streamUrl && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={streamUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3 py-2 text-xs bg-field text-fg-body border border-line rounded-lg font-mono select-all outline-none focus:border-focus"
          />
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            {copied ? t('settings.copiedUrl') : t('settings.copyUrl')}
          </button>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-fg-label mb-2">
          {t('dashboard.configuredLanguages')}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm text-fg-hint">{t('dashboard.noLanguages')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {targets.map((tgt) => (
              <span
                key={tgt.id}
                className="inline-flex items-center gap-1.5 text-xs text-fg-body"
              >
                <span className="font-semibold">
                  {tgt.targetLanguage.toUpperCase()}
                </span>
                <span className="text-fg-hint">
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
