import { KeyRound, Loader2, Server, Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import { parseAuthUrl, setApiUrl } from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { ScanPairingCodeButton } from './ScanPairingCodeButton'
import { useConnectionTest } from '../hooks/useConnectionTest'

interface ApiUrlSetupProps {
  onComplete: () => void
}

/**
 * First-run setup screen for configuring the API URL on mobile
 */
export function ApiUrlSetup({ onComplete }: ApiUrlSetupProps) {
  const { t } = useTranslation('settings')

  const [url, setUrlState] = useState('')
  const {
    status: connectionStatus,
    isLoading,
    errorMessage,
    setErrorMessage,
    test,
    reset,
  } = useConnectionTest()

  // Check if the URL contains an auth token
  const hasAuthToken = useMemo(() => {
    if (!url) return false
    const { userToken } = parseAuthUrl(url)
    return userToken !== null
  }, [url])

  const handleTestConnection = () => test(url)

  // A scanned code connects at once: nothing left to type or confirm.
  const handleScanned = async (scanned: string) => {
    setUrlState(scanned)
    if (await test(scanned)) {
      setApiUrl(scanned)
      onComplete()
    }
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
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <div className="w-full max-w-md bg-panel border border-line rounded-xl p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex items-center justify-center text-fg-label">
            <Server strokeWidth={1.5} className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-fg">
            {t('sections.apiUrl.setup.title')}
          </h1>
          <p className="text-sm text-fg-label">
            {t('sections.apiUrl.setup.description')}
          </p>
        </div>

        <div className="space-y-4">
          {isMobile() && (
            <ScanPairingCodeButton
              onScanned={handleScanned}
              onError={setErrorMessage}
              disabled={isLoading}
            />
          )}

          <div className="space-y-2">
            <label
              htmlFor="api-url"
              className="block text-sm font-medium text-fg-body"
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
                reset()
              }}
              disabled={isLoading}
            />
            <p className="text-xs text-fg-hint">{t('sections.apiUrl.hint')}</p>
            {hasAuthToken && (
              <div className="flex items-center gap-2 text-sm text-fg-body">
                <KeyRound strokeWidth={1.5} className="w-4 h-4 text-fg-label" />
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
            <div className="flex items-center gap-2 text-sm text-fg-body">
              <Wifi strokeWidth={1.5} className="w-4 h-4 text-ok" />
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
                  <Loader2
                    strokeWidth={1.5}
                    className="w-4 h-4 mr-2 animate-spin"
                  />
                  {t('sections.apiUrl.testing')}
                </>
              ) : connectionStatus === 'error' ? (
                <>
                  <WifiOff strokeWidth={1.5} className="w-4 h-4 mr-2" />
                  {t('sections.apiUrl.retry')}
                </>
              ) : (
                <>
                  <Wifi strokeWidth={1.5} className="w-4 h-4 mr-2" />
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
