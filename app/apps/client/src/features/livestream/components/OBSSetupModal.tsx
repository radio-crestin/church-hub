import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useOBSConfig } from '../hooks'

interface OBSSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function OBSSetupModal({ isOpen, onClose }: OBSSetupModalProps) {
  const { t } = useTranslation('livestream')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const { config, update, isUpdating } = useOBSConfig()
  const [copied, setCopied] = useState(false)
  const [host, setHost] = useState(config?.host || 'localhost')

  const generatedPassword = useMemo(() => generateRandomPassword(), [])

  const password = config?.password || generatedPassword

  useEffect(() => {
    if (config?.host) {
      setHost(config.host)
    }
  }, [config?.host])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

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

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveAndClose = () => {
    const hostChanged = host !== config?.host
    const passwordChanged = !config?.password

    if (hostChanged || passwordChanged) {
      update({
        host: host || 'localhost',
        port: config?.port || 4455,
        password: passwordChanged ? generatedPassword : config?.password,
        autoConnect: config?.autoConnect ?? true,
      })
    }
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg w-full"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('obs.setup.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('obs.setup.step1Title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('obs.setup.step1Description')}
            </p>
            <a
              href="https://github.com/obsproject/obs-websocket/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {t('obs.setup.downloadLink')}
            </a>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('obs.setup.step2Title')}
            </h3>
            <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
              <li>{t('obs.setup.step2Instruction1')}</li>
              <li>{t('obs.setup.step2Instruction2')}</li>
              <li>{t('obs.setup.step2Instruction3')}</li>
            </ol>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('obs.setup.step3Title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('obs.setup.step3Description')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {password}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyPassword}
              >
                {copied ? t('obs.setup.copied') : t('obs.setup.copy')}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('obs.setup.addressTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('obs.setup.addressDescription')}
            </p>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t('obs.setup.addressPlaceholder')}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>{t('obs.setup.noteTitle')}</strong>{' '}
              {t('obs.setup.noteDescription')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            {t('common:buttons.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSaveAndClose} disabled={isUpdating}>
            {t('obs.setup.saveAndClose')}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
