import { Loader2, Server, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import { getStoredApiUrl, setApiUrl } from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { useToast } from '~/ui/toast'
import { ScanPairingCodeButton } from './ScanPairingCodeButton'
import { useConnectionTest } from '../hooks/useConnectionTest'

/**
 * Settings section for managing the API URL on mobile
 */
export function ApiUrlSettings() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()

  const [url, setUrl] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const {
    status: connectionStatus,
    isLoading,
    errorMessage,
    setErrorMessage,
    test,
    reset,
  } = useConnectionTest()

  useEffect(() => {
    const storedUrl = getStoredApiUrl()
    if (storedUrl) {
      setUrl(storedUrl)
      setOriginalUrl(storedUrl)
    }
  }, [])

  const hasChanges = url !== originalUrl

  const handleTestConnection = () => test(url)

  // A scanned code is tested and, once it answers, saved.
  const handleScanned = async (scanned: string) => {
    setUrl(scanned)
    if (await test(scanned)) save(scanned)
  }

  const save = (target: string) => {
    setApiUrl(target)
    setOriginalUrl(target)
    showToast(t('sections.apiUrl.saved'), 'success')
  }

  const handleSave = () => {
    if (connectionStatus !== 'success') {
      setErrorMessage(t('sections.apiUrl.errors.testFirst'))
      return
    }

    save(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Server strokeWidth={1.5} className="w-4 h-4 text-fg-label" />
        <h3 className="text-base font-semibold text-fg">
          {t('sections.apiUrl.title')}
        </h3>
      </div>

      <p className="text-sm text-fg-label">
        {t('sections.apiUrl.settingsDescription')}
      </p>

      <div className="space-y-3">
        {isMobile() && (
          <ScanPairingCodeButton
            onScanned={handleScanned}
            onError={setErrorMessage}
            disabled={isLoading}
          />
        )}

        <div className="space-y-2">
          <label
            htmlFor="settings-api-url"
            className="block text-sm font-medium text-fg-body"
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
              reset()
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
          <div className="flex items-center gap-2 text-sm text-fg-body">
            <Wifi strokeWidth={1.5} className="w-4 h-4 text-ok" />
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
