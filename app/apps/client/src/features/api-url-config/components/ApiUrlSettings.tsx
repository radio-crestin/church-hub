import { Loader2, Server, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getStoredApiUrl,
  isValidApiUrl,
  setApiUrl,
  testApiConnection,
} from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { useToast } from '~/ui/toast'

/**
 * Settings section for managing the API URL on mobile
 */
export function ApiUrlSettings() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()

  const [url, setUrl] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const storedUrl = getStoredApiUrl()
    if (storedUrl) {
      setUrl(storedUrl)
      setOriginalUrl(storedUrl)
    }
  }, [])

  const hasChanges = url !== originalUrl

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setErrorMessage(t('sections.apiUrl.errors.emptyUrl'))
      return
    }

    if (!isValidApiUrl(url)) {
      setErrorMessage(t('sections.apiUrl.errors.invalidUrl'))
      return
    }

    setIsLoading(true)
    setConnectionStatus('testing')
    setErrorMessage('')

    const isConnected = await testApiConnection(url)

    if (isConnected) {
      setConnectionStatus('success')
    } else {
      setConnectionStatus('error')
      setErrorMessage(t('sections.apiUrl.errors.connectionFailed'))
    }

    setIsLoading(false)
  }

  const handleSave = () => {
    if (connectionStatus !== 'success') {
      setErrorMessage(t('sections.apiUrl.errors.testFirst'))
      return
    }

    setApiUrl(url)
    setOriginalUrl(url)
    showToast(t('sections.apiUrl.saved'), 'success')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('sections.apiUrl.title')}
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('sections.apiUrl.settingsDescription')}
      </p>

      <div className="space-y-3">
        <div className="space-y-2">
          <label
            htmlFor="settings-api-url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('sections.apiUrl.label')}
          </label>
          <Input
            id="settings-api-url"
            type="url"
            placeholder="https://your-server.com:3000"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setConnectionStatus('idle')
              setErrorMessage('')
            }}
            disabled={isLoading}
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        {connectionStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Wifi className="w-4 h-4" />
            <span>{t('sections.apiUrl.connectionSuccess')}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={isLoading || !url.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('sections.apiUrl.testing')}
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <WifiOff className="w-4 h-4 mr-2" />
                {t('sections.apiUrl.retry')}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                {t('sections.apiUrl.testConnection')}
              </>
            )}
          </Button>

          {hasChanges && connectionStatus === 'success' && (
            <Button variant="primary" size="sm" onClick={handleSave}>
              {t('sections.apiUrl.save')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
