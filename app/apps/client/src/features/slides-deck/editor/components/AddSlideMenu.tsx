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
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[13px] font-medium text-fg-label hover:bg-hover hover:text-fg"
      >
        <Plus size={14} strokeWidth={1.75} />
        {t('deckEditor.newSlide')}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-48 rounded-[10px] border border-line bg-panel p-1 shadow-popover">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              data-testid={`deck-editor-add-slide-${kind}`}
              onClick={() => {
                setOpen(false)
                onAdd(kind)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-fg-body hover:bg-hover"
            >
              {t(`deckEditor.kinds.${kind}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
