import { KeyRound, Loader2, Server, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getStoredApiUrl,
  isValidApiUrl,
  parseAuthUrl,
  setApiUrl,
  testApiConnection,
} from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'

interface ServerConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnected: () => void
}

/**
 * Modal for reconnecting to server when connection is lost on mobile
 */
export function ServerConnectionModal({
  isOpen,
  onClose,
  onConnected,
}: ServerConnectionModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  const [url, setUrlState] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Load current URL on open
  useEffect(() => {
    if (isOpen) {
      const storedUrl = getStoredApiUrl()
      if (storedUrl) {
        setUrlState(storedUrl)
      }
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

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
      setErrorMessage(
        result.error || t('sections.apiUrl.errors.connectionFailed'),
      )
    }

    setIsLoading(false)
  }

  const handleSave = () => {
    if (connectionStatus !== 'success') {
      setErrorMessage(t('sections.apiUrl.errors.testFirst'))
      return
    }

    setApiUrl(url)
    onConnected()
    onClose()
    // Reload to re-establish connection
    window.location.reload()
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-md w-[calc(100%-2rem)]"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('sections.apiUrl.modal.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('sections.apiUrl.modal.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="server-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('sections.apiUrl.label')}
            </label>
            <Input
              id="server-url"
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
              {t('sections.apiUrl.reconnect')}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
