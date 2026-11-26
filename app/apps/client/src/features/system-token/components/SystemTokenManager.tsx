import { Copy, Eye, EyeOff, Key, RefreshCw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { fetcher } from '~/utils/fetcher'

interface SystemTokenInfo {
  token: string
  lastUsedAt: string | null
  createdAt: string
}

export function SystemTokenManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [tokenInfo, setTokenInfo] = useState<SystemTokenInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const fetchToken = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetcher<{ data: SystemTokenInfo | null }>(
        '/api/system-token',
      )
      setTokenInfo(response.data)
      setShowToken(true)
    } catch {
      showToast(t('sections.systemToken.toast.fetchError'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [t, showToast])

  const regenerateToken = async () => {
    setIsRegenerating(true)
    try {
      const response = await fetcher<{ data: { token: string } }>(
        '/api/system-token/regenerate',
        { method: 'POST' },
      )
      setTokenInfo((prev) =>
        prev
          ? { ...prev, token: response.data.token, lastUsedAt: null }
          : {
              token: response.data.token,
              lastUsedAt: null,
              createdAt: new Date().toISOString(),
            },
      )
      setShowToken(true)
      showToast(t('sections.systemToken.toast.regenerated'), 'success')
    } catch {
      showToast(t('sections.systemToken.toast.regenerateError'), 'error')
    } finally {
      setIsRegenerating(false)
    }
  }

  const copyToken = () => {
    if (tokenInfo?.token) {
      navigator.clipboard.writeText(tokenInfo.token)
      showToast(t('sections.systemToken.toast.copied'), 'success')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('sections.systemToken.never')
    return new Date(dateString).toLocaleString()
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-fg mb-2">
        {t('sections.systemToken.title')}
      </h3>
      <p className="text-fg-label text-sm mb-4">
        {t('sections.systemToken.description')}
      </p>

      {!tokenInfo && !showToken ? (
        <button
          type="button"
          onClick={fetchToken}
          disabled={isLoading}
          className="inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Key strokeWidth={1.5} className="w-4 h-4" />
          {isLoading
            ? t('sections.systemToken.loading')
            : t('sections.systemToken.showToken')}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-field rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-body">
                {t('sections.systemToken.token')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
                  title={
                    showToken
                      ? t('sections.systemToken.hide')
                      : t('sections.systemToken.show')
                  }
                >
                  {showToken ? (
                    <EyeOff strokeWidth={1.5} className="w-4 h-4" />
                  ) : (
                    <Eye strokeWidth={1.5} className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyToken}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
                  title={t('sections.systemToken.copy')}
                >
                  <Copy strokeWidth={1.5} className="w-4 h-4" />
                </button>
              </div>
            </div>
            <code className="block text-sm font-mono text-fg-body bg-panel p-2 rounded-lg break-all">
              {showToken
                ? tokenInfo?.token
                : tokenInfo?.token.replace(/./g, '*')}
            </code>
          </div>

          {tokenInfo && (
            <div className="text-xs text-fg-hint space-y-1">
              <p>
                {t('sections.systemToken.createdAt')}:{' '}
                {formatDate(tokenInfo.createdAt)}
              </p>
              <p>
                {t('sections.systemToken.lastUsed')}:{' '}
                {formatDate(tokenInfo.lastUsedAt)}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={regenerateToken}
              disabled={isRegenerating}
              className="inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium bg-field text-fg rounded-lg hover:bg-hover disabled:opacity-50"
            >
              <RefreshCw
                strokeWidth={1.5}
                className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
              />
              {isRegenerating
                ? t('sections.systemToken.regenerating')
                : t('sections.systemToken.regenerate')}
            </button>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('sections.systemToken.regenerateWarning')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
