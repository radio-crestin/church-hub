import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { YouTubeSetupModal } from './YouTubeSetupModal'
import { useYouTubeAuth, useYouTubeConfig } from '../hooks'

export function YouTubeConnectionButton() {
  const { t } = useTranslation('livestream')
  const {
    isAuthenticated,
    channelName,
    login,
    logout,
    isLoggingOut,
    isLoading,
    isAuthenticating,
  } = useYouTubeAuth()
  const { config, isLoading: isConfigLoading } = useYouTubeConfig()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isBusy = isLoading || isLoggingOut || isAuthenticating

  // Auto-open setup modal after successful authentication (only if no broadcast selected)
  useEffect(() => {
    // Wait for config to load before deciding to show modal
    if (isConfigLoading) return

    if (!wasAuthenticated && isAuthenticated && !config?.selectedBroadcastId) {
      setIsSetupModalOpen(true)
    }
    setWasAuthenticated(isAuthenticated)
  }, [
    isAuthenticated,
    wasAuthenticated,
    config?.selectedBroadcastId,
    isConfigLoading,
  ])

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
    if (isBusy) return
    setIsMenuOpen(!isMenuOpen)
  }

  function handleConnect() {
    setIsMenuOpen(false)
    login()
  }

  function handleDisconnect() {
    setIsMenuOpen(false)
    logout()
  }

  function handleOpenGuide() {
    setIsMenuOpen(false)
    setIsSetupModalOpen(true)
  }

  function getStatusText() {
    if (isAuthenticating) return t('youtube.authenticating')
    if (isLoggingOut) return t('youtube.loggingOut')
    if (isAuthenticated && channelName) return channelName
    if (isAuthenticated)
      return t('youtube.connected').replace('{{channelName}}', '').trim()
    return t('youtube.notConnected').replace('YouTube ', '')
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        disabled={isBusy}
        className={`
          inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 ease-in-out
          ${
            isAuthenticated
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              : isAuthenticating
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 cursor-wait'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }
          ${isBusy ? 'opacity-75 cursor-wait' : 'cursor-pointer'}
        `}
      >
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span className="font-medium">
            <span className="sm:hidden">YT</span>
            <span className="hidden sm:inline">YouTube</span>
          </span>
        </div>

        <span className="text-xs opacity-75 max-w-[120px] truncate hidden sm:inline">
          {getStatusText()}
        </span>

        {isAuthenticating && (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-2 z-50 min-w-[140px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1"
        >
          {isAuthenticated ? (
            <>
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
                {t('youtube.openGuide')}
              </button>
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
                {t('youtube.logout')}
              </button>
            </>
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
                {t('youtube.login')}
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
                {t('youtube.openGuide')}
              </button>
            </>
          )}
        </div>
      )}

      <YouTubeSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </div>
  )
}
