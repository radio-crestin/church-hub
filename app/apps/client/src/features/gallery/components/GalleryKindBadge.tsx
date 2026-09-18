import { ImageIcon, VideoIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { BackgroundMediaKind } from '~/features/background-media/service/types'

interface GalleryKindBadgeProps {
  kind: BackgroundMediaKind
  className?: string
}

/** "Image" or "Video" with its icon, readable on top of a picture. */
export function GalleryKindBadge({
  kind,
  className = '',
}: GalleryKindBadgeProps) {
  const { t } = useTranslation('gallery')
  const Icon = kind === 'video' ? VideoIcon : ImageIcon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`kinds.${kind}`)}
    </span>
  )
}
