import { Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import type { BackgroundMediaKind } from '../service'
import { getBackgroundMediaAccept } from '../utils/getBackgroundMediaAccept'

interface BackgroundMediaUploadButtonProps {
  /** Restricts the dialog to images or videos; omitted, it takes either */
  kind?: BackgroundMediaKind
  isUploading: boolean
  onFileSelected: (file: File) => void
}

/**
 * Opens the file dialog through a hidden file input — the webview's own
 * dialog, which works in the browser and in Tauri on every OS.
 */
export function BackgroundMediaUploadButton({
  kind,
  isUploading,
  onFileSelected,
}: BackgroundMediaUploadButtonProps) {
  const { t } = useTranslation('presentation')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Let the same file be picked again (e.g. after a failed upload).
    event.target.value = ''
    if (file) onFileSelected(file)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="background-media-upload-button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {isUploading
          ? t('screens.background.uploading')
          : t(`screens.background.upload.${kind ?? 'any'}`)}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={getBackgroundMediaAccept(kind)}
        onChange={handleChange}
        data-testid="background-media-upload-input"
        className="hidden"
      />
    </>
  )
}
