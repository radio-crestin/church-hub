import type { ChainedCommands } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FONT_FAMILY_OPTIONS } from '~/features/presentation/utils/fontFamilyOptions'
import { ColorField } from './ColorField'
import { NumberField } from './NumberField'
import { PanelField } from './PanelField'
import { ToggleButton } from './ToggleButton'
import type { DeckShapeElement, DeckTextElement } from '../../types'
import { transformTextHtml } from '../utils/transformTextHtml'

interface TextControlsProps {
  element: DeckTextElement | DeckShapeElement
  /** The text editor while the box is edited in place: commands go to its selection. */
  editor: Editor | null
  update: (patch: Partial<DeckTextElement>, merge?: string) => void
}

/**
 * A text box's font, size and colour, and bold, italic, underline, alignment
 * and lists: on the selected words while it is edited, else on all its text.
 */
export function TextControls({ element, editor, update }: TextControlsProps) {
  const { t } = useTranslation('schedules')
  const text = element.type === 'text' ? element : null
  const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
    if (editor) {
      command(editor.chain().focus()).run()
      return
    }
    update({ html: transformTextHtml(element.html ?? '', command) })
  }
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false

  return (
    <div className="space-y-2">
      {text && (
        <>
          <PanelField label={t('deckEditor.design.font')}>
            <select
              data-testid="deck-editor-font"
              value={text.fontFamily ?? ''}
              onChange={(e) =>
                update({ fontFamily: e.target.value || undefined })
              }
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">{t('deckEditor.design.themeFont')}</option>
              {FONT_FAMILY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PanelField>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t('deckEditor.design.size')}
              value={text.fontSize ?? 40}
              min={1}
              testId="deck-editor-font-size"
              onChange={(fontSize) =>
                update({ fontSize }, `fontSize:${element.id}`)
              }
            />
            <ColorField
              label={t('deckEditor.design.textColor')}
              value={text.color}
              testId="deck-editor-text-color"
              onChange={(color) => update({ color }, `color:${element.id}`)}
            />
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-0.5">
        <ToggleButton
          icon={Bold}
          label={t('deckEditor.design.bold')}
          active={isActive('bold')}
          testId="deck-editor-bold"
          onClick={() => run((c) => c.toggleBold())}
        />
        <ToggleButton
          icon={Italic}
          label={t('deckEditor.design.italic')}
          active={isActive('italic')}
          onClick={() => run((c) => c.toggleItalic())}
        />
        <ToggleButton
          icon={Underline}
          label={t('deckEditor.design.underline')}
          active={isActive('underline')}
          onClick={() => run((c) => c.toggleUnderline())}
        />
        <ToggleButton
          icon={AlignLeft}
          label={t('deckEditor.design.alignLeft')}
          active={isActive('paragraph', { textAlign: 'left' })}
          onClick={() => run((c) => c.setTextAlign('left'))}
        />
        <ToggleButton
          icon={AlignCenter}
          label={t('deckEditor.design.alignCenter')}
          active={isActive('paragraph', { textAlign: 'center' })}
          testId="deck-editor-align-center"
          onClick={() => run((c) => c.setTextAlign('center'))}
        />
        <ToggleButton
          icon={AlignRight}
          label={t('deckEditor.design.alignRight')}
          active={isActive('paragraph', { textAlign: 'right' })}
          onClick={() => run((c) => c.setTextAlign('right'))}
        />
        <ToggleButton
          icon={List}
          label={t('deckEditor.design.bullets')}
          active={isActive('bulletList')}
          onClick={() => run((c) => c.toggleBulletList())}
        />
        <ToggleButton
          icon={ListOrdered}
          label={t('deckEditor.design.numbers')}
          active={isActive('orderedList')}
          onClick={() => run((c) => c.toggleOrderedList())}
        />
      </div>
      {text && (
        <div className="flex gap-1">
          {(['top', 'middle', 'bottom'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => update({ verticalAlign: align })}
              className={`flex-1 rounded-md px-2 py-1 text-xs ${
                (text.verticalAlign ?? 'top') === align
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {t(`deckEditor.design.vertical.${align}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
