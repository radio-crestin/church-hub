import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ColorField } from './ColorField'
import { MediaPickerDialog } from './MediaPickerDialog'
import type { DeckSlide } from '../../types'
import type { DeckAction } from '../types'
import { mediaIdOf } from '../utils/mediaIdOf'

interface SlideBackgroundControlsProps {
  slide: DeckSlide
  change: (action: DeckAction, merge?: string) => void
}

/** The slide's background: a colour, or a picture or video from the gallery. */
export function SlideBackgroundControls({
  slide,
  change,
}: SlideBackgroundControlsProps) {
  const { t } = useTranslation('schedules')
  const [picking, setPicking] = useState<'image' | 'video' | null>(null)
  const background = slide.background
  const type = background?.type ?? 'color'
  const set = (patch: Partial<DeckSlide>, merge?: string) =>
    change({ type: 'slide/update', slideId: slide.id, patch }, merge)

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 rounded-lg bg-field p-0.5">
        {(['color', 'image', 'video'] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`deck-editor-background-${option}`}
            onClick={() =>
              option === 'color'
                ? set({ background: { type: 'color', color: '#000000' } })
                : setPicking(option)
            }
            className={`flex-1 rounded-md px-2 py-1 text-sm font-medium ${
              type === option
                ? 'bg-selected text-fg'
                : 'text-fg-label hover:text-fg'
            }`}
          >
            {t(`deckEditor.background.${option}`)}
          </button>
        ))}
      </div>
      {background?.type !== 'image' && background?.type !== 'video' && (
        <ColorField
          label={t('deckEditor.background.color')}
          value={background?.type === 'color' ? background.color : undefined}
          testId="deck-editor-background-color-input"
          onChange={(color) =>
            set(
              { background: { type: 'color', color } },
              `background:${slide.id}`,
            )
          }
        />
      )}
      {picking && (
        <MediaPickerDialog
          kind={picking}
          onClose={() => setPicking(null)}
          onPick={(selection) =>
            set({
              background: {
                type: selection.kind,
                mediaId: mediaIdOf(selection.url),
                fit: 'cover',
              },
            })
          }
        />
      )}
    </div>
  )
}
