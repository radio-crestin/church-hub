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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('sections.systemToken.title')}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
        {t('sections.systemToken.description')}
      </p>

      {!tokenInfo && !showToken ? (
        <button
          type="button"
          onClick={fetchToken}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          <Key className="w-4 h-4" />
          {isLoading
            ? t('sections.systemToken.loading')
            : t('sections.systemToken.showToken')}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('sections.systemToken.token')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title={
                    showToken
                      ? t('sections.systemToken.hide')
                      : t('sections.systemToken.show')
                  }
                >
                  {showToken ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyToken}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title={t('sections.systemToken.copy')}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <code className="block text-sm font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded break-all">
              {showToken
                ? tokenInfo?.token
                : tokenInfo?.token.replace(/./g, '*')}
            </code>
          </div>

          {tokenInfo && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw
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
