import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LocalSlide } from './SongSlideList'
import { markdownToSlides, slidesToMarkdown } from '../utils/slidesMarkdown'

interface SongSlidesTextEditorProps {
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
}

/**
 * The Slides section edited as one block of text, in place of the slide cards.
 *
 * The text is seeded once, when the section switches to text mode. From then on
 * every keystroke is turned back into slides, so the draft (and the verse rail
 * beside it) always matches what is typed, and switching back to the cards
 * needs no extra "apply" step.
 */
export function SongSlidesTextEditor({
  slides,
  onSlidesChange,
}: SongSlidesTextEditorProps) {
  const { t } = useTranslation('songs')
  const [text, setText] = useState(() => slidesToMarkdown(slides))

  const handleChange = (value: string) => {
    setText(value)
    onSlidesChange(markdownToSlides(value))
  }

  return (
    <div data-testid="song-slides-text-editor" className="space-y-2">
      <textarea
        data-testid="song-slides-text-input"
        autoFocus
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t('editAsText.placeholder')}
        spellCheck={false}
        className="block h-[60vh] min-h-64 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('editAsText.formatHelp')}
      </p>
      <p className="text-sm text-indigo-600 dark:text-indigo-400">
        {t('editAsText.preview', { count: slides.length })}
      </p>
    </div>
  )
}
