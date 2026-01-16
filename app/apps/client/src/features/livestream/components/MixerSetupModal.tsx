import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useMixerChannels, useMixerConfig } from '../hooks'

interface MixerSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

const CHANNEL_COUNT_OPTIONS = [8, 16, 24, 32]

export function MixerSetupModal({ isOpen, onClose }: MixerSetupModalProps) {
  const { t } = useTranslation('livestream')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const { config, update, isUpdating, testConnection, isTesting } =
    useMixerConfig()
  const {
    channels,
    update: updateChannels,
    isUpdating: isUpdatingChannels,
  } = useMixerChannels()

  const [host, setHost] = useState('')
  const [port, setPort] = useState(10024)
  const [channelCount, setChannelCount] = useState(16)
  const [channelLabels, setChannelLabels] = useState<Record<number, string>>({})
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  )

  useEffect(() => {
    if (config) {
      setHost(config.host)
      setPort(config.port)
      setChannelCount(config.channelCount)
    }
  }, [config])

  useEffect(() => {
    const labels: Record<number, string> = {}
    for (const channel of channels) {
      labels[channel.channelNumber] = channel.label
    }
    setChannelLabels(labels)
  }, [channels])

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

  const handleTestConnection = async () => {
    setTestStatus('idle')
    try {
      const result = await testConnection()
      setTestStatus(result.success ? 'success' : 'error')
    } catch {
      setTestStatus('error')
    }
  }

  const handleChannelLabelChange = (channelNumber: number, label: string) => {
    setChannelLabels((prev) => ({
      ...prev,
      [channelNumber]: label,
    }))
  }

  const handleSave = async () => {
    update({
      host,
      port,
      isEnabled: config?.isEnabled ?? false,
      channelCount,
    })

    const channelsToUpdate = Object.entries(channelLabels)
      .filter(([, label]) => label.trim() !== '')
      .map(([num, label]) => ({
        channelNumber: Number.parseInt(num, 10),
        label: label.trim(),
      }))

    if (channelsToUpdate.length > 0) {
      updateChannels(channelsToUpdate)
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('mixer.setup.title')}
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

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('mixer.setup.description')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {t('mixer.setup.supportedMixers')}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {t('mixer.setup.connectionSettings')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('mixer.setup.host')}
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="192.168.0.50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('mixer.setup.port')}
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number.parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="10024"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || !host}
                >
                  {isTesting
                    ? t('mixer.setup.testing')
                    : t('mixer.setup.testConnection')}
                </Button>
                {testStatus === 'success' && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {t('mixer.setup.testSuccess')}
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {t('mixer.setup.testFailed')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {t('mixer.setup.channelConfiguration')}
            </h3>

            <div className="mb-3">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('mixer.setup.channelCount')}
              </label>
              <select
                value={channelCount}
                onChange={(e) =>
                  setChannelCount(Number.parseInt(e.target.value, 10))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CHANNEL_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {Array.from({ length: channelCount }, (_, i) => i + 1).map(
                (num) => (
                  <div key={num} className="flex items-center gap-2">
                    <span className="w-8 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {num.toString().padStart(2, '0')}:
                    </span>
                    <input
                      type="text"
                      value={channelLabels[num] || ''}
                      onChange={(e) =>
                        handleChannelLabelChange(num, e.target.value)
                      }
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={`CH${num.toString().padStart(2, '0')}`}
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            {t('common:buttons.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating || isUpdatingChannels}
          >
            {t('mixer.setup.save')}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
