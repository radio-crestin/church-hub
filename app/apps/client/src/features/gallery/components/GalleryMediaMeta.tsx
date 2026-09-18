import { useTranslation } from 'react-i18next'

import type { BackgroundMedia } from '~/features/background-media/service/types'
import { formatFileSize } from '../utils/formatFileSize'

interface GalleryMediaMetaProps {
  media: BackgroundMedia
  className?: string
}

/** A file's size and upload date, in the app's language. */
export function GalleryMediaMeta({
  media,
  className = '',
}: GalleryMediaMetaProps) {
  const { i18n } = useTranslation()
  const uploadedAt = new Date(media.createdAt)

  return (
    <p className={`flex min-w-0 items-center gap-1.5 text-xs ${className}`}>
      <span className="shrink-0 tabular-nums">
        {formatFileSize(media.size, i18n.language)}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={uploadedAt.toISOString()} className="truncate">
        {uploadedAt.toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
      </time>
    </p>
  )
}
