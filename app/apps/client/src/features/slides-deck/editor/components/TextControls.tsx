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
import { getFontFamilyStack } from '~/features/presentation/utils/getFontFamilyStack'
import { ColorField } from './ColorField'
import { NumberField } from './NumberField'
import { PanelField } from './PanelField'
import { ToggleButton } from './ToggleButton'
import type { DeckShapeElement, DeckTextElement } from '../../types'
import { useSelectionTextStyle } from '../hooks/useSelectionTextStyle'
import { transformTextHtml } from '../utils/transformTextHtml'

interface TextControlsProps {
  element: DeckTextElement | DeckShapeElement
  /** The text editor while the box is edited in place: commands go to its selection. */
  editor: Editor | null
  update: (patch: Partial<DeckTextElement>, merge?: string) => void
}

const DEFAULT_SIZE = 40

/**
 * A text box's font, size and colour, and bold, italic, underline, alignment
 * and lists: on the selected words while it is edited (font, size and colour
 * as their `<span style>`, the size in em of the box's), else on all its text.
 */
export function TextControls({ element, editor, update }: TextControlsProps) {
  const { t } = useTranslation('schedules')
  const text = element.type === 'text' ? element : null
  // The whole box's HTML changed by a command (when it is not edited).
  const html = (command: (chain: ChainedCommands) => ChainedCommands) =>
    transformTextHtml(element.html ?? '', command)
  const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
    if (editor) {
      command(editor.chain().focus()).run()
      return
    }
    update({ html: html(command) })
  }
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false
  const boxSize = text?.fontSize ?? DEFAULT_SIZE
  const shown = useSelectionTextStyle(editor, {
    fontFamily: text?.fontFamily,
    fontSize: boxSize,
    color: text?.color,
  })
  // On the whole box, its runs' own font, size or colour go.
  // Without focus(): the field being typed in keeps it, the editor its selection.
  const setFont = (name: string) => {
    if (!editor) {
      return update({
        fontFamily: name || undefined,
        html: html((c) => c.unsetFontFamily()),
      })
    }
    const chain = editor.chain()
    const stack = getFontFamilyStack(name)
    ;(stack ? chain.setFontFamily(stack) : chain.unsetFontFamily()).run()
  }
  const setSize = (size: number) => {
    if (!editor) {
      return update(
        { fontSize: size, html: html((c) => c.unsetFontSize()) },
        `fontSize:${element.id}`,
      )
    }
    const em = Math.round((size / boxSize) * 1000) / 1000
    editor.chain().setFontSize(`${em}em`).run()
  }
  const setColor = (color: string) => {
    if (!editor) {
      return update(
        { color, html: html((c) => c.unsetColor()) },
        `color:${element.id}`,
      )
    }
    editor.chain().setColor(color).run()
  }
  const fonts =
    shown.fontFamily &&
    !FONT_FAMILY_OPTIONS.some((o) => o.value === shown.fontFamily)
      ? [
          { value: shown.fontFamily, label: shown.fontFamily },
          ...FONT_FAMILY_OPTIONS,
        ]
      : FONT_FAMILY_OPTIONS

  return (
    <div className="space-y-2">
      {text && (
        <>
          <PanelField label={t('deckEditor.design.font')}>
            <select
              data-testid="deck-editor-font"
              value={shown.fontFamily ?? ''}
              onChange={(e) => setFont(e.target.value)}
              className="h-8 w-full rounded-[10px] border-0 bg-field px-2 text-base md:text-sm text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
            >
              <option value="">{t('deckEditor.design.themeFont')}</option>
              {fonts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PanelField>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t('deckEditor.design.size')}
              value={shown.fontSize ?? boxSize}
              min={1}
              testId="deck-editor-font-size"
              onChange={setSize}
            />
            <ColorField
              label={t('deckEditor.design.textColor')}
              value={shown.color}
              testId="deck-editor-text-color"
              onChange={setColor}
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
        <div className="flex gap-0.5 rounded-lg bg-field p-0.5">
          {(['top', 'middle', 'bottom'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => update({ verticalAlign: align })}
              className={`flex-1 rounded-md px-2 py-1 text-sm font-medium ${
                (text.verticalAlign ?? 'top') === align
                  ? 'bg-selected text-fg'
                  : 'text-fg-label hover:text-fg'
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
