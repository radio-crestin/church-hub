import { KeyRound, Loader2, Server, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getStoredApiUrl, parseAuthUrl, setApiUrl } from '~/service/api-url'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { useConnectionTest } from '../hooks/useConnectionTest'

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
  const {
    status: connectionStatus,
    isLoading,
    errorMessage,
    setErrorMessage,
    test,
    reset,
  } = useConnectionTest()

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

  const handleTestConnection = () => test(url)

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
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-md w-[calc(100%-2rem)]"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center text-fg-label">
              <Server strokeWidth={1.5} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">
                {t('sections.apiUrl.modal.title')}
              </h2>
              <p className="text-[13px] text-fg-label">
                {t('sections.apiUrl.modal.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
          >
            <X strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="server-url"
              className="block text-[13px] font-medium text-fg-body"
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
                reset()
              }}
              disabled={isLoading}
            />
            {hasAuthToken && (
              <div className="flex items-center gap-2 text-[13px] text-fg-body">
                <KeyRound strokeWidth={1.5} className="w-4 h-4 text-fg-label" />
                <span>{t('sections.apiUrl.authTokenDetected')}</span>
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-[13px] text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          {connectionStatus === 'success' && (
            <div className="flex items-center gap-2 text-[13px] text-fg-body">
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
              {t('sections.apiUrl.reconnect')}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
