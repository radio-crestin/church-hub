import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DeckSlideKind } from '../../types'

const KINDS: DeckSlideKind[] = [
  'title',
  'title_text',
  'picture',
  'video',
  'blank',
]

/** "New slide", with PowerPoint's slide kinds to pick from. */
export function AddSlideMenu({
  onAdd,
}: {
  onAdd: (kind: DeckSlideKind) => void
}) {
  const { t } = useTranslation('schedules')
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-testid="deck-editor-add-slide"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Plus size={14} />
        {t('deckEditor.newSlide')}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              data-testid={`deck-editor-add-slide-${kind}`}
              onClick={() => {
                setOpen(false)
                onAdd(kind)
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t(`deckEditor.kinds.${kind}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
