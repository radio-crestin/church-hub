import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenPreview } from '~/features/presentation/components/ScreenPreview'
import type { SlideTemplate } from '../types'
import { templateAsScreen } from '../utils/templateAsScreen'

interface TemplateThumbnailProps {
  template: SlideTemplate
  className?: string
}

/**
 * A template drawing a sample verse with the real renderer, in its own
 * proportions: what it looks like on a display.
 */
export function TemplateThumbnail({
  template,
  className = '',
}: TemplateThumbnailProps) {
  const { t } = useTranslation('presentation')
  const screen = useMemo(() => templateAsScreen(template), [template])
  const contentData = useMemo(
    () => ({
      referenceText: t('templates.sample.reference'),
      contentText: t('templates.sample.verse'),
    }),
    [t],
  )

  const portrait = template.height > template.width * (9 / 16)

  // Every template in the same 16:9 frame, drawn in its own proportions.
  return (
    <div
      data-testid="template-thumbnail"
      className={`flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black ${className}`}
    >
      <div
        className={`relative ${portrait ? 'h-full' : 'w-full'}`}
        style={{ aspectRatio: `${template.width} / ${template.height}` }}
      >
        <ScreenPreview
          screen={screen}
          contentType="bible"
          contentData={contentData}
          contentKey={`template-${template.id}`}
          playVideo={false}
        />
      </div>
    </div>
  )
}
