import { KeyRound, Loader2, Server, Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isValidApiUrl, parseAuthUrl, setApiUrl, testApiConnection } from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'

interface ApiUrlSetupProps {
  onComplete: () => void
}

/**
 * First-run setup screen for configuring the API URL on mobile
 */
export function ApiUrlSetup({ onComplete }: ApiUrlSetupProps) {
  const { t } = useTranslation('settings')

  const [url, setUrlState] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Check if the URL contains an auth token
  const hasAuthToken = useMemo(() => {
    if (!url) return false
    const { userToken } = parseAuthUrl(url)
    return userToken !== null
  }, [url])

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

    const result = await testApiConnection(url)

    if (result.success) {
      setConnectionStatus('success')
    } else {
      setConnectionStatus('error')
      // Show the actual error message for debugging
      setErrorMessage(result.error || t('sections.apiUrl.errors.connectionFailed'))
    }

    setIsLoading(false)
  }

  const handleSave = () => {
    if (connectionStatus !== 'success') {
      setErrorMessage(t('sections.apiUrl.errors.testFirst'))
      return
    }

    setApiUrl(url)
    onComplete()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
            <Server className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('sections.apiUrl.setup.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('sections.apiUrl.setup.description')}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="api-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('sections.apiUrl.label')}
            </label>
            <Input
              id="api-url"
              type="url"
              placeholder="http://192.168.x.x:3000/api/auth/user/usr_TOKEN"
              value={url}
              onChange={(e) => {
                setUrlState(e.target.value)
                setConnectionStatus('idle')
                setErrorMessage('')
              }}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('sections.apiUrl.hint')}
            </p>
            {hasAuthToken && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <KeyRound className="w-4 h-4" />
                <span>{t('sections.apiUrl.authTokenDetected')}</span>
              </div>
            )}
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

          <div className="flex flex-col gap-3">
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              disabled={isLoading || !url.trim()}
              className="w-full"
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

            <Button
              variant="primary"
              onClick={handleSave}
              disabled={connectionStatus !== 'success'}
              className="w-full"
            >
              {t('sections.apiUrl.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
