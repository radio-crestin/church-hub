import { Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getBackgroundMediaAccept } from '~/features/background-media/utils/getBackgroundMediaAccept'
import { Button } from '~/ui/button/Button'
import type { GalleryUploadProgress } from '../types'

interface GalleryUploadButtonProps {
  progress: GalleryUploadProgress | null
  onFilesSelected: (files: File[]) => void
}

/**
 * Picks any number of images and videos through a hidden file input — the
 * webview's own dialog, which works in the browser and in Tauri on every OS.
 */
export function GalleryUploadButton({
  progress,
  onFilesSelected,
}: GalleryUploadButtonProps) {
  const { t } = useTranslation('gallery')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Copy the list before clearing the input: clearing it empties the list.
    const files = Array.from(event.target.files ?? [])
    // Let the same files be picked again (e.g. after a failed upload).
    event.target.value = ''
    if (files.length > 0) onFilesSelected(files)
  }

  return (
    <>
      <Button
        type="button"
        data-testid="gallery-upload-button"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
        className="w-full sm:w-auto"
      >
        {progress ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {progress
          ? t('upload.progress', {
              current: progress.current,
              total: progress.total,
            })
          : t('upload.button')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={getBackgroundMediaAccept()}
        onChange={handleChange}
        data-testid="gallery-upload-input"
        className="hidden"
      />
    </>
  )
}
