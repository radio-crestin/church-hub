import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'

import { ElementControls } from './ElementControls'
import { SlideBackgroundControls } from './SlideBackgroundControls'
import type { DeckElement, DeckSlide } from '../../types'
import type { DeckAction } from '../types'

interface DesignTabProps {
  slide: DeckSlide
  selected: DeckElement | undefined
  editor: Editor | null
  change: (action: DeckAction, merge?: string) => void
}

/** The Design tab: the slide's background, then the selected element's look. */
export function DesignTab({ slide, selected, editor, change }: DesignTabProps) {
  const { t } = useTranslation('schedules')
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('deckEditor.design.slide')}
        </h3>
        <SlideBackgroundControls slide={slide} change={change} />
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('deckEditor.design.element')}
        </h3>
        {selected ? (
          <ElementControls
            element={selected}
            editor={editor}
            update={(patch, merge) =>
              change(
                {
                  type: 'element/update',
                  slideId: slide.id,
                  elementId: selected.id,
                  patch,
                },
                merge,
              )
            }
          />
        ) : (
          <p className="text-sm text-gray-500">
            {t('deckEditor.design.nothingSelected')}
          </p>
        )}
      </section>
    </div>
  )
}
