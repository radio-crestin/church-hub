import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MixerSetupModal } from './MixerSetupModal'
import { useMixerConfig } from '../hooks'
import { testMixerConnection } from '../service/mixer'

const CONNECTION_CHECK_INTERVAL_MS = 5000
const RECONNECT_RETRY_INTERVAL_MS = 1000

export function MixerConnectionButton() {
  const { t } = useTranslation('livestream')
  const { config, update, isUpdating, testConnection, isTesting } =
    useMixerConfig()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  )
  const [isConnected, setIsConnected] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null)

  const isEnabled = config?.isEnabled ?? false

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  // Close menu on Escape key
  useEffect(() => {
    if (!isMenuOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMenuOpen])

  // Use ref to track if check is in progress to avoid dependency issues
  const isCheckingRef = useRef(false)
  const isConnectedRef = useRef(false)

  // Keep ref in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  // Background connection check - calls service directly to avoid hook state updates
  const checkConnection = useCallback(async () => {
    if (!config?.host || isCheckingRef.current) return

    isCheckingRef.current = true
    // Only update checking state when not connected (to show loading UI)
    if (!isConnectedRef.current) {
      setIsCheckingConnection(true)
    }
    try {
      // Call service directly instead of hook's testConnection to avoid isTesting state updates
      const result = await testMixerConnection()
      // Only update state if value actually changed
      if (result.success !== isConnectedRef.current) {
        setIsConnected(result.success)
      }
    } catch {
      // Only update state if value actually changed
      if (isConnectedRef.current) {
        setIsConnected(false)
      }
    } finally {
      isCheckingRef.current = false
      if (!isConnectedRef.current) {
        setIsCheckingConnection(false)
      }
    }
  }, [config?.host])

  // Connection monitoring effect - uses setTimeout to schedule next check based on connection status
  useEffect(() => {
    if (!isEnabled || !config?.host) {
      if (isConnectedRef.current) {
        setIsConnected(false)
      }
      if (connectionCheckRef.current) {
        clearTimeout(connectionCheckRef.current)
        connectionCheckRef.current = null
      }
      return
    }

    let isMounted = true

    const runCheck = async () => {
      if (!isMounted) return

      await checkConnection()

      if (!isMounted) return

      // Schedule next check based on current connection status
      const interval = isConnectedRef.current
        ? CONNECTION_CHECK_INTERVAL_MS
        : RECONNECT_RETRY_INTERVAL_MS
      connectionCheckRef.current = setTimeout(runCheck, interval)
    }

    // Initial connection check
    runCheck()

    return () => {
      isMounted = false
      if (connectionCheckRef.current) {
        clearTimeout(connectionCheckRef.current)
        connectionCheckRef.current = null
      }
    }
  }, [isEnabled, config?.host, checkConnection])

  function handleButtonClick() {
    setIsMenuOpen(!isMenuOpen)
  }

  function handleOpenSettings() {
    setIsMenuOpen(false)
    setIsSetupModalOpen(true)
  }

  async function handleTestConnection() {
    setTestStatus('idle')
    try {
      const result = await testConnection()
      setTestStatus(result.success ? 'success' : 'error')
      // Reset status after 3 seconds
      setTimeout(() => setTestStatus('idle'), 3000)
    } catch {
      setTestStatus('error')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  function handleToggleEnabled() {
    if (!config) return
    update({
      ...config,
      isEnabled: !config.isEnabled,
    })
    setIsMenuOpen(false)
  }

  function getStatusText() {
    if (isConnected) return t('mixer.connected').replace('Mixer ', '')
    return t('mixer.disconnected').replace('Mixer ', '')
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={`
          inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 ease-in-out cursor-pointer
          ${
            isConnected
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }
        `}
      >
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <span className="font-medium">{t('mixer.title')}</span>
        </div>

        <span className="text-xs opacity-75 hidden sm:inline">
          {getStatusText()}
        </span>
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-2 z-50 min-w-[140px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1"
        >
          <button
            type="button"
            onClick={handleOpenSettings}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {t('mixer.openGuide')}
          </button>

          {config?.host && (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left rounded-lg transition-colors ${
                testStatus === 'success'
                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                  : testStatus === 'error'
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {testStatus === 'success' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                ) : testStatus === 'error' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                )}
              </svg>
              {isTesting
                ? t('mixer.setup.testing')
                : testStatus === 'success'
                  ? t('mixer.setup.testSuccess')
                  : testStatus === 'error'
                    ? t('mixer.setup.testFailed')
                    : t('mixer.setup.testConnection')}
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isUpdating || !config?.host}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left rounded-lg transition-colors ${
              !config?.host
                ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : isEnabled
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isEnabled ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 9v2m0 4h.01"
                />
              )}
            </svg>
            {isEnabled ? t('mixer.disable') : t('mixer.enable')}
          </button>
        </div>
      )}

      <MixerSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </div>
  )
}
