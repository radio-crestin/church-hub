import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'

import { ColorField } from './ColorField'
import { NumberField } from './NumberField'
import { PanelField } from './PanelField'
import { TextControls } from './TextControls'
import type { DeckElement } from '../../types'

interface ElementControlsProps {
  element: DeckElement
  editor: Editor | null
  update: (patch: Partial<DeckElement>, merge?: string) => void
}

/** The selected element's place and look, by its type. */
export function ElementControls({
  element,
  editor,
  update,
}: ElementControlsProps) {
  const { t } = useTranslation('schedules')
  const box = (key: 'x' | 'y' | 'w' | 'h') => (
    <NumberField
      label={t(`deckEditor.design.${key}`)}
      value={element[key]}
      testId={`deck-editor-${key}`}
      onChange={(value) =>
        update({ [key]: Math.round(value) }, `${key}:${element.id}`)
      }
    />
  )
  const check = (key: 'loop' | 'muted' | 'autoplay', fallback: boolean) =>
    element.type === 'video' && (
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={element[key] ?? fallback}
          onChange={(e) => update({ [key]: e.target.checked })}
        />
        {t(`deckEditor.design.${key}`)}
      </label>
    )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {box('x')}
        {box('y')}
        {box('w')}
        {box('h')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t('deckEditor.design.rotation')}
          value={element.rotation ?? 0}
          onChange={(rotation) =>
            update(
              { rotation: rotation || undefined },
              `rotation:${element.id}`,
            )
          }
        />
        <NumberField
          label={t('deckEditor.design.opacity')}
          value={Math.round((element.opacity ?? 1) * 100)}
          min={0}
          max={100}
          onChange={(value) =>
            update(
              { opacity: Math.min(1, Math.max(0, value / 100)) },
              `opacity:${element.id}`,
            )
          }
        />
      </div>
      {element.type === 'shape' && (
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label={t('deckEditor.design.fill')}
            value={element.fill}
            testId="deck-editor-fill"
            onChange={(fill) => update({ fill }, `fill:${element.id}`)}
          />
          <ColorField
            label={t('deckEditor.design.stroke')}
            value={element.stroke}
            onChange={(stroke) => update({ stroke }, `stroke:${element.id}`)}
          />
          <NumberField
            label={t('deckEditor.design.strokeWidth')}
            value={element.strokeWidth ?? 0}
            min={0}
            onChange={(strokeWidth) =>
              update({ strokeWidth }, `strokeWidth:${element.id}`)
            }
          />
        </div>
      )}
      {element.type === 'image' && (
        <PanelField label={t('deckEditor.design.fit')}>
          <select
            value={element.fit ?? 'contain'}
            onChange={(e) =>
              update({ fit: e.target.value as 'cover' | 'contain' | 'fill' })
            }
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {(['contain', 'cover', 'fill'] as const).map((fit) => (
              <option key={fit} value={fit}>
                {t(`deckEditor.design.fits.${fit}`)}
              </option>
            ))}
          </select>
        </PanelField>
      )}
      {check('autoplay', true)}
      {check('loop', false)}
      {check('muted', false)}
      {(element.type === 'text' || element.type === 'shape') && (
        <TextControls
          element={element}
          editor={editor}
          update={(patch, merge) =>
            update(patch as Partial<DeckElement>, merge)
          }
        />
      )}
    </div>
  )
}
