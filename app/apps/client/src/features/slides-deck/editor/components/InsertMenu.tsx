import {
  Circle,
  FileInput,
  Film,
  Image,
  Minus,
  Plus,
  RectangleHorizontal,
  Square,
  Triangle,
  Type,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DeckShape } from '../../types'

export type DeckInsertChoice = 'text' | 'image' | 'video' | 'pptx' | DeckShape

const CHOICES: { choice: DeckInsertChoice; icon: typeof Type }[] = [
  { choice: 'text', icon: Type },
  { choice: 'image', icon: Image },
  { choice: 'video', icon: Film },
  { choice: 'rect', icon: Square },
  { choice: 'roundRect', icon: RectangleHorizontal },
  { choice: 'ellipse', icon: Circle },
  { choice: 'triangle', icon: Triangle },
  { choice: 'line', icon: Minus },
  { choice: 'pptx', icon: FileInput },
]

/** Insert: a text box, a picture or video from the gallery, a shape, or slides from a PowerPoint file. */
export function InsertMenu({
  onInsert,
}: {
  onInsert: (choice: DeckInsertChoice) => void
}) {
  const { t } = useTranslation('schedules')
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="deck-editor-insert"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
      >
        <Plus size={14} />
        {t('deckEditor.insert.title')}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {CHOICES.map(({ choice, icon: Icon }) => (
            <button
              key={choice}
              type="button"
              data-testid={`deck-editor-insert-${choice}`}
              onClick={() => {
                setOpen(false)
                onInsert(choice)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Icon size={14} />
              {t(`deckEditor.insert.${choice}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
