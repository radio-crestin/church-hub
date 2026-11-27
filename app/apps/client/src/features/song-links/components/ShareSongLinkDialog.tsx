import { useMutation } from '@tanstack/react-query'
import { ExternalLink, Link2Off, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  dangerButton,
  secondaryButton,
} from '~/features/song-sources/components/buttonStyles'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import {
  SongLinkError,
  shareSongLink,
  unshareSongLink,
} from '../service/songLinks'

interface ShareSongLinkDialogProps {
  isOpen: boolean
  onClose: () => void
  songId: number
}

/**
 * Shares a song by link: opening it publishes the song as it reads now and
 * shows the link, to copy, open, or stop.
 */
export function ShareSongLinkDialog({
  isOpen,
  onClose,
  songId,
}: ShareSongLinkDialogProps) {
  const { t } = useTranslation('songLibrary')
  const { showToast } = useToast()
  const share = useMutation({ mutationFn: () => shareSongLink(songId) })
  const unshare = useMutation({
    mutationFn: () => unshareSongLink(songId),
    onSuccess: () => {
      showToast(t('link.stopped'), 'success')
      onClose()
    },
    onError: () => showToast(t('link.failed'), 'error'),
  })
  const { mutate, reset } = share

  useEffect(() => {
    if (isOpen) mutate()
    else reset()
  }, [isOpen, mutate, reset])

  const url = share.data?.url
  const errorCode =
    share.error instanceof SongLinkError ? share.error.code : null

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    showToast(t('link.copied'), 'success')
    onClose()
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('link.title')}
      message={t('link.message')}
      confirmLabel={t('link.copy')}
      cancelLabel={t('link.close')}
      onConfirm={copy}
      onCancel={onClose}
      isLoading={!url}
      testId="song-link-dialog"
    >
      {share.isPending && (
        <p className="text-sm text-fg-hint">{t('link.creating')}</p>
      )}
      {share.isError && (
        <p className="text-sm text-fg" role="alert">
          {errorCode === 'cloud_sync_off'
            ? t('link.cloudSyncOff')
            : t('link.failed')}
        </p>
      )}
      {url && (
        <div className="space-y-2">
          <p
            className="break-all rounded-md bg-field px-2 py-1 font-mono text-xs text-fg-body"
            data-testid="song-link-url"
          >
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={secondaryButton}
            >
              <ExternalLink size={14} />
              {t('link.open')}
            </a>
            <button
              type="button"
              className={dangerButton}
              disabled={unshare.isPending}
              onClick={() => unshare.mutate()}
              data-testid="song-link-stop"
            >
              <Link2Off size={14} />
              {t('link.stop')}
            </button>
          </div>
        </div>
      )}
      {!url && !share.isPending && share.isError && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => mutate()}
        >
          <RefreshCw size={14} />
          {t('link.retry')}
        </button>
      )}
    </ConfirmModal>
  )
}
