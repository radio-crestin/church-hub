import { useTranslation } from 'react-i18next'

import type {
  ScreenWithConfigs,
  TemporaryContent,
} from '~/features/presentation'
import { ScreenPreview, usePresentationContent } from '~/features/presentation'

interface StageCanvasProps {
  screen: ScreenWithConfigs
  previewContent: TemporaryContent
  /** Whether the current slide can be edited (false when there are no slides) */
  canEdit: boolean
  onEditText: (plainText: string) => void
}

/**
 * Large WYSIWYG editing canvas. Renders the current slide exactly as it will be
 * projected (via the shared presentation content hook) and makes the lyrics
 * editable in place, PowerPoint-style.
 */
export function StageCanvas({
  screen,
  previewContent,
  canEdit,
  onEditText,
}: StageCanvasProps) {
  const { t } = useTranslation('songs')

  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({ screen, includeNextSlide: false, previewContent })

  return (
    <div className="w-full">
      {/* In navigate mode (canEdit off) the canvas is a read-only presentation
          surface — disable text selection so words can't be highlighted. */}
      <div
        className={`relative w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black ${
          canEdit ? '' : 'select-none'
        }`}
      >
        <ScreenPreview
          screen={screen}
          contentType={contentType}
          contentData={contentData}
          contentKey={contentKey}
          isVisible={isVisible}
          editableMainText={canEdit}
          editPlaceholder={t('stageEditor.emptySlidePlaceholder')}
          onMainTextEdit={onEditText}
        />
      </div>
      {canEdit && (
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('stageEditor.editHint')}
        </p>
      )}
    </div>
  )
}
