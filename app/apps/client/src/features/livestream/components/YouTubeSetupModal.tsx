import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import {
  Combobox,
  type ComboboxOptionDetail,
} from '../../../ui/combobox/Combobox'
import {
  usePastBroadcasts,
  useStreamKeys,
  useYouTubeConfig,
  useYoutubePlaylists,
} from '../hooks'
import type { PastBroadcast } from '../types'
import { openExternalUrl } from '../utils'

interface YouTubeSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

export function YouTubeSetupModal({ isOpen, onClose }: YouTubeSetupModalProps) {
  const { t } = useTranslation('livestream')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const { config, update, isUpdating } = useYouTubeConfig()
  const { broadcasts } = usePastBroadcasts(isOpen)
  const { data: streamKeys, isLoading: isLoadingStreamKeys } = useStreamKeys()
  const { playlists, isLoading: isLoadingPlaylists } =
    useYoutubePlaylists(isOpen)

  const [selectedPastBroadcastId, setSelectedPastBroadcastId] = useState<
    string | null
  >(null)
  const [selectedPastBroadcast, setSelectedPastBroadcast] =
    useState<PastBroadcast | null>(null)
  const [selectedStreamKeyId, setSelectedStreamKeyId] = useState<string>('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('')
  const [hasInitialized, setHasInitialized] = useState(false)

  // Initialize selection from saved config when broadcasts are loaded
  useEffect(() => {
    if (hasInitialized) return

    // Initialize stream key from config
    if (config?.streamKeyId) {
      setSelectedStreamKeyId(config.streamKeyId)
    }

    // Initialize playlist from config
    if (config?.playlistId) {
      setSelectedPlaylistId(config.playlistId)
    }

    // Initialize past broadcast selection
    if (config?.selectedBroadcastId && broadcasts.length) {
      const savedBroadcast = broadcasts.find(
        (b) => b.broadcastId === config.selectedBroadcastId,
      )
      if (savedBroadcast) {
        setSelectedPastBroadcastId(savedBroadcast.broadcastId)
        setSelectedPastBroadcast(savedBroadcast)
      }
    }

    if (config) {
      setHasInitialized(true)
    }
  }, [config, broadcasts, hasInitialized])

  // Reset initialization when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false)
    }
  }, [isOpen])

  const handleSelectPastBroadcast = (broadcast: PastBroadcast | null) => {
    setSelectedPastBroadcastId(broadcast?.broadcastId ?? null)
    setSelectedPastBroadcast(broadcast)
    // Update stream key if the broadcast has one
    if (broadcast?.boundStreamId) {
      setSelectedStreamKeyId(broadcast.boundStreamId)
    }
  }

  const handleSaveAndClose = () => {
    const updateData: Parameters<typeof update>[0] = {
      streamKeyId: selectedStreamKeyId || undefined,
      playlistId: selectedPlaylistId || undefined,
    }

    if (selectedPastBroadcast) {
      updateData.titleTemplate = selectedPastBroadcast.title
      updateData.description = selectedPastBroadcast.description
      updateData.privacyStatus = selectedPastBroadcast.privacyStatus
      updateData.selectedBroadcastId = selectedPastBroadcast.broadcastId
    }

    update(updateData)
    onClose()
  }

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

  const handleOpenYouTubeStudio = () => {
    openExternalUrl('https://studio.youtube.com/channel/UC/livestreaming')
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg w-full max-h-[90vh] overflow-hidden"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('youtube.setup.title')}
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Broadcast Template Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('youtube.setup.templateTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('youtube.setup.templateDescription')}
            </p>
            <Combobox
              options={broadcasts.map((broadcast) => {
                const details: ComboboxOptionDetail[] = []

                // Add privacy status
                const privacyVariant =
                  broadcast.privacyStatus === 'public'
                    ? 'success'
                    : broadcast.privacyStatus === 'unlisted'
                      ? 'warning'
                      : 'error'
                details.push({
                  label: t(
                    `youtube.privacy${broadcast.privacyStatus.charAt(0).toUpperCase() + broadcast.privacyStatus.slice(1)}`,
                  ),
                  variant: privacyVariant,
                })

                // Add stream key if available
                const streamKey = streamKeys?.find(
                  (k) => k.id === broadcast.boundStreamId,
                )
                if (streamKey) {
                  details.push({
                    label: streamKey.name,
                    variant: 'info',
                  })
                }

                return {
                  value: broadcast.broadcastId,
                  label: broadcast.title,
                  description: new Date(
                    broadcast.completedAt,
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                  details,
                }
              })}
              value={selectedPastBroadcastId}
              onChange={(value) => {
                const broadcast = broadcasts.find(
                  (b) => b.broadcastId === value,
                )
                handleSelectPastBroadcast(broadcast || null)
              }}
              placeholder={t('youtube.setup.selectTemplate')}
              allowClear={true}
              portalContainer={dialogRef.current}
            />
          </div>

          {/* Selected Template Info */}
          {selectedPastBroadcast && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {selectedPastBroadcast.title}
                  </p>
                  {selectedPastBroadcast.description && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 line-clamp-2">
                      {selectedPastBroadcast.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {t('youtube.setup.completedAt')}{' '}
                      {new Date(
                        selectedPastBroadcast.completedAt,
                      ).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {selectedPastBroadcast.boundStreamId &&
                      streamKeys?.find(
                        (k) => k.id === selectedPastBroadcast.boundStreamId,
                      ) && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          {
                            streamKeys.find(
                              (k) =>
                                k.id === selectedPastBroadcast.boundStreamId,
                            )?.name
                          }
                        </span>
                      )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    selectedPastBroadcast.privacyStatus === 'public'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : selectedPastBroadcast.privacyStatus === 'unlisted'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {t(
                    `youtube.privacy${selectedPastBroadcast.privacyStatus.charAt(0).toUpperCase() + selectedPastBroadcast.privacyStatus.slice(1)}`,
                  )}
                </span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                {t('youtube.setup.usingTemplateHint')}
              </p>
            </div>
          )}

          {/* Stream Key Selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('youtube.streamKey')}
            </h3>
            <Combobox
              options={
                streamKeys?.map((key) => ({
                  value: key.id,
                  label: key.name,
                })) ?? []
              }
              value={selectedStreamKeyId || null}
              onChange={(value) =>
                setSelectedStreamKeyId(value?.toString() ?? '')
              }
              placeholder={t('youtube.selectStreamKey')}
              disabled={isLoadingStreamKeys}
              allowClear={false}
              portalContainer={dialogRef.current}
            />
          </div>

          {/* Playlist Selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('youtube.setup.playlistTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('youtube.setup.playlistDescription')}
            </p>
            <Combobox
              options={playlists.map((playlist) => ({
                value: playlist.id,
                label: playlist.title,
              }))}
              value={selectedPlaylistId || null}
              onChange={(value) =>
                setSelectedPlaylistId(value?.toString() ?? '')
              }
              placeholder={t('youtube.setup.selectPlaylist')}
              disabled={isLoadingPlaylists}
              allowClear={true}
              portalContainer={dialogRef.current}
            />
          </div>

          {/* Selected Playlist Info */}
          {selectedPlaylistId && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>{t('youtube.setup.usingPlaylist')}:</strong>{' '}
                {playlists.find((p) => p.id === selectedPlaylistId)?.title}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {t('youtube.setup.usingPlaylistHint')}
              </p>
            </div>
          )}

          {/* First Time Instructions */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('youtube.setup.firstTimeTitle')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('youtube.setup.firstTimeDescription')}
            </p>
            <button
              type="button"
              onClick={handleOpenYouTubeStudio}
              className="inline-flex items-center gap-2 text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              {t('youtube.setup.openYouTubeStudio')}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="primary"
            onClick={handleSaveAndClose}
            disabled={isUpdating}
          >
            {t('youtube.setup.saveAndClose')}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
