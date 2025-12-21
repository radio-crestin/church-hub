import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OBSSetupModal } from './OBSSetupModal'
import { useOBSConnection } from '../hooks'

export function OBSConnectionButton() {
  const { t } = useTranslation('livestream')
  const { isConnected, isConnecting, isDisconnecting, connect, disconnect } =
    useOBSConnection()
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isLoading = isConnecting || isDisconnecting

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

  function handleButtonClick() {
    if (isLoading) return
    setIsMenuOpen(!isMenuOpen)
  }

  function handleConnect() {
    setIsMenuOpen(false)
    connect()
  }

  function handleDisconnect() {
    setIsMenuOpen(false)
    disconnect()
  }

  function handleOpenGuide() {
    setIsMenuOpen(false)
    setIsSetupModalOpen(true)
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            transition-all duration-200 ease-in-out
            ${
              isConnected
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                : isConnecting
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 cursor-wait'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
            ${isLoading ? 'opacity-75 cursor-wait' : 'cursor-pointer'}
          `}
        >
          <div className="relative flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? 'bg-green-500'
                  : isConnecting
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-400 dark:bg-gray-500'
              }`}
            />
            <span className="font-medium">OBS Studio</span>
          </div>

          <span className="text-xs opacity-75">
            {isConnecting
              ? t('obs.connecting')
              : isDisconnecting
                ? t('obs.disconnect') + '...'
                : isConnected
                  ? t('obs.connected').replace('OBS ', '')
                  : t('obs.disconnected').replace('OBS ', '')}
          </span>
        </button>

        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 z-50 min-w-[180px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1"
          >
            {isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {t('obs.disconnect')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleConnect}
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
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  {t('obs.connect')}
                </button>
                <button
                  type="button"
                  onClick={handleOpenGuide}
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
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t('obs.openGuide')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <OBSSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </>
  )
}
