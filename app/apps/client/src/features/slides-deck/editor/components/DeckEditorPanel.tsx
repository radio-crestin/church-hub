import type { Editor } from '@tiptap/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimationsTab } from './AnimationsTab'
import { DesignTab } from './DesignTab'
import { TransitionTab } from './TransitionTab'
import type { DeckElement, DeckSlide } from '../../types'
import type { DeckAction } from '../types'

const TABS = ['design', 'transition', 'animations'] as const
type Tab = (typeof TABS)[number]

interface DeckEditorPanelProps {
  slide: DeckSlide
  selected: DeckElement | undefined
  onSelect: (elementId: string) => void
  editor: Editor | null
  change: (action: DeckAction, merge?: string) => void
  onPreview: () => void
  previewing: boolean
  /** A sheet under the canvas that folds away (a phone), else a side panel. */
  sheet: boolean
}

/** The panel of tabs beside the canvas: Design, Transition, Animations. */
export function DeckEditorPanel({
  slide,
  selected,
  onSelect,
  editor,
  change,
  onPreview,
  previewing,
  sheet,
}: DeckEditorPanelProps) {
  const { t } = useTranslation('schedules')
  const [tab, setTab] = useState<Tab>('design')
  const [open, setOpen] = useState(true)

  return (
    <aside
      data-testid="deck-editor-panel"
      className={
        sheet
          ? `flex shrink-0 flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:border-gray-700 dark:bg-gray-900 ${open ? 'max-h-[45vh]' : ''}`
          : 'flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
      }
    >
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 dark:border-gray-700">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            data-testid={`deck-editor-tab-${name}`}
            onClick={() => {
              setTab(name)
              setOpen(true)
            }}
            className={`px-3 py-2 text-sm font-medium ${
              tab === name
                ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
            }`}
          >
            {t(`deckEditor.tabs.${name}`)}
          </button>
        ))}
        {sheet && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto rounded p-1 text-gray-500"
            aria-label={
              open ? t('deckEditor.hidePanel') : t('deckEditor.showPanel')
            }
          >
            {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        )}
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'design' && (
            <DesignTab
              slide={slide}
              selected={selected}
              editor={editor}
              change={change}
            />
          )}
          {tab === 'transition' && (
            <TransitionTab slide={slide} change={change} />
          )}
          {tab === 'animations' && (
            <AnimationsTab
              slide={slide}
              selected={selected}
              onSelect={onSelect}
              change={change}
              onPreview={onPreview}
              previewing={previewing}
            />
          )}
        </div>
      )}
    </aside>
  )
}
