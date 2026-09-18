import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { BackgroundMediaTile } from './BackgroundMediaTile'
import { BackgroundMediaUploadButton } from './BackgroundMediaUploadButton'
import {
  useBackgroundMediaList,
  useDeleteBackgroundMedia,
  useUploadBackgroundMedia,
} from '../hooks'
import {
  type BackgroundMedia,
  type BackgroundMediaKind,
  BackgroundMediaUploadError,
} from '../service'
import { validateBackgroundMediaFile } from '../utils/validateBackgroundMediaFile'

const logger = createLogger('app:background-media')

interface BackgroundMediaPickerProps {
  kind: BackgroundMediaKind
  /** The stored URL of the chosen file */
  value?: string
  /** Called with the chosen file's URL ('' when the chosen file is deleted) */
  onChange: (url: string) => void
}

/**
 * Lists the uploaded images or videos, uploads new ones (selecting each as it
 * arrives) and deletes them.
 */
export function BackgroundMediaPicker({
  kind,
  value,
  onChange,
}: BackgroundMediaPickerProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { data: media = [], isLoading, isError } = useBackgroundMediaList()
  const uploadMutation = useUploadBackgroundMedia()
  const deleteMutation = useDeleteBackgroundMedia()
  const [pendingDelete, setPendingDelete] = useState<BackgroundMedia | null>(
    null,
  )

  // An upload can take minutes: report its result to the latest `onChange`, so
  // edits made meanwhile (opacity, colour) are not overwritten by a stale one.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const items = media.filter((item) => item.kind === kind)

  const handleFileSelected = (file: File) => {
    const refusal = validateBackgroundMediaFile(file, kind)
    if (refusal) {
      showToast(t(`screens.background.errors.${refusal}`), 'error')
      return
    }

    uploadMutation.mutate(file, {
      onSuccess: (uploaded) => onChangeRef.current(uploaded.url),
      onError: (error) => {
        logger.error(`Upload of ${file.name} failed`, error)
        const code =
          error instanceof BackgroundMediaUploadError
            ? error.code
            : 'uploadFailed'
        showToast(t(`screens.background.errors.${code}`), 'error')
      },
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)

    deleteMutation.mutate(target.id, {
      // Don't leave the screen pointing at a file that no longer exists.
      onSuccess: () => {
        if (target.url === value) onChangeRef.current('')
      },
      onError: (error) => {
        logger.error(`Delete of ${target.id} failed`, error)
        showToast(t('screens.background.errors.deleteFailed'), 'error')
      },
    })
  }

  return (
    <div data-testid="background-media-picker" className="space-y-2">
      <BackgroundMediaUploadButton
        kind={kind}
        isUploading={uploadMutation.isPending}
        onFileSelected={handleFileSelected}
      />

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t('screens.background.errors.loadFailed')}
        </p>
      ) : items.length === 0 ? (
        <p
          data-testid="background-media-empty"
          className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
        >
          {t(`screens.background.empty.${kind}`)}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 p-0.5 sm:grid-cols-4 md:grid-cols-3">
          {items.map((item) => (
            <BackgroundMediaTile
              key={item.id}
              media={item}
              isSelected={item.url === value}
              onSelect={() => onChange(item.url)}
              onDelete={() => setPendingDelete(item)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t(`screens.background.hint.${kind}`)}
      </p>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={t('screens.background.deleteConfirmTitle')}
        message={t('screens.background.deleteConfirm')}
        confirmLabel={t('screens.background.delete')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
