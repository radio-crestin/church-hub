import type { Editor } from '@tiptap/react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '~/hooks/useMediaQuery'
import { DeckCanvas } from './DeckCanvas'
import { DeckEditorPanel } from './DeckEditorPanel'
import { DeckEditorToolbar } from './DeckEditorToolbar'
import type { DeckInsertChoice } from './InsertMenu'
import { MediaPickerDialog } from './MediaPickerDialog'
import { SlideThumbnailList } from './SlideThumbnailList'
import { useDeckTitleStyle } from '../../hooks/useDeckTitleStyle'
import { PptxImportDialog } from '../../pptx-import/components/PptxImportDialog'
import { usePptxImport } from '../../pptx-import/hooks/usePptxImport'
import type { PptxImportResult } from '../../pptx-import/types'
import { fitSlidesToDeck } from '../../pptx-import/utils/fitSlidesToDeck'
import type { DeckSlideKind, SlideDeck } from '../../types'
import { newSlide } from '../../utils/newSlide'
import { useDeckEditorKeys } from '../hooks/useDeckEditorKeys'
import { useDeckPreview } from '../hooks/useDeckPreview'
import { useDeckAutosave } from '../state/useDeckAutosave'
import { useDeckHistory } from '../state/useDeckHistory'
import type { DeckAction } from '../types'
import { mediaIdOf } from '../utils/mediaIdOf'
import { type DeckInsert, newElement } from '../utils/newElement'
import { withFreshIds } from '../utils/withFreshIds'

interface DeckEditorProps {
  scheduleId: number
  itemId: number
  title: string
  initialDeck: SlideDeck
  /** The slide open first. */
  initialSlideIndex: number
  onBack: () => void
}

/**
 * The PowerPoint-like editor of a Slides item: slides on the left (a strip on
 * top on a phone), the slide on the canvas, Design, Transition and
 * Animations beside it (a sheet under it on a phone). Every change can be
 * undone and is saved a moment later.
 */
export function DeckEditor({
  scheduleId,
  itemId,
  title,
  initialDeck,
  initialSlideIndex,
  onBack,
}: DeckEditorProps) {
  const { t } = useTranslation('schedules')
  const phone = !useMediaQuery('(min-width: 1024px)')
  const style = useDeckTitleStyle(scheduleId)
  const { deck, change, undo, redo, canUndo, canRedo } =
    useDeckHistory(initialDeck)
  const status = useDeckAutosave(scheduleId, itemId, deck)
  const [slideId, setSlideId] = useState(
    initialDeck.slides[initialSlideIndex]?.id ??
      initialDeck.slides[0]?.id ??
      '',
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [textEditor, setTextEditor] = useState<Editor | null>(null)
  const [picking, setPicking] = useState<'image' | 'video' | null>(null)

  // Slides from a PowerPoint file go after the last one, whatever was open.
  const deckRef = useRef(deck)
  deckRef.current = deck
  const pptx = usePptxImport(
    useCallback(
      async ({ deck: imported }: PptxImportResult) => {
        const current = deckRef.current
        const slides = fitSlidesToDeck(imported, current)
        change({ type: 'slide/add', slides, index: current.slides.length })
        if (slides[0]) setSlideId(slides[0].id)
      },
      [change],
    ),
  )

  // A removed or undone slide leaves the first one open.
  const slide = deck.slides.find((s) => s.id === slideId) ?? deck.slides[0]
  const selected = slide?.elements.find((e) => e.id === selectedId)
  const preview = useDeckPreview(deck, slide)

  const select = useCallback((elementId: string | null) => {
    setSelectedId(elementId)
    if (!elementId) setEditingId(null)
  }, [])
  const openSlide = (id: string) => {
    setSlideId(id)
    setSelectedId(null)
    setEditingId(null)
    preview.stop()
  }
  const placeholders = {
    title: t('slidesDeck.titlePlaceholder'),
    text: t('slidesDeck.textPlaceholder'),
  }

  useDeckEditorKeys({ slide, selected, select, change, undo, redo })

  if (!slide) return null

  const insert = (what: DeckInsert) => {
    const element = newElement(what, deck.width, deck.height)
    change({ type: 'element/insert', slideId: slide.id, elements: [element] })
    setSelectedId(element.id)
  }
  const handleInsert = (choice: DeckInsertChoice) => {
    if (choice === 'pptx') pptx.choose()
    else if (choice === 'image' || choice === 'video') setPicking(choice)
    else if (choice === 'text')
      insert({ type: 'text', text: placeholders.text, style })
    else insert({ type: 'shape', shape: choice })
  }
  const onSelected = (action: (id: string) => DeckAction) => {
    if (selected) change(action(selected.id))
  }

  return (
    <div
      data-testid="deck-editor"
      className="flex h-full min-h-0 flex-col bg-app"
    >
      <DeckEditorToolbar
        title={title}
        status={status}
        selected={selected}
        canUndo={canUndo}
        canRedo={canRedo}
        onBack={onBack}
        onInsert={handleInsert}
        onUndo={undo}
        onRedo={redo}
        onOrder={(direction) =>
          onSelected((elementId) => ({
            type: 'element/order',
            slideId: slide.id,
            elementId,
            direction,
          }))
        }
        onToggleLock={() =>
          onSelected((elementId) => ({
            type: 'element/update',
            slideId: slide.id,
            elementId,
            patch: { locked: selected?.locked ? undefined : true },
          }))
        }
        onDuplicate={() => {
          if (!selected) return
          const [copy] = withFreshIds([
            {
              ...selected,
              x: selected.x + 20,
              y: selected.y + 20,
              locked: undefined,
            },
          ])
          if (!copy) return
          change({
            type: 'element/insert',
            slideId: slide.id,
            elements: [copy],
          })
          setSelectedId(copy.id)
        }}
        onDelete={() => {
          onSelected((elementId) => ({
            type: 'element/remove',
            slideId: slide.id,
            elementId,
          }))
          select(null)
        }}
      />
      <div className={`flex min-h-0 flex-1 ${phone ? 'flex-col' : 'flex-row'}`}>
        <div
          className={
            phone
              ? 'shrink-0 border-b border-line bg-panel'
              : 'w-52 shrink-0 overflow-y-auto border-r border-line bg-panel'
          }
        >
          <SlideThumbnailList
            deck={deck}
            selectedSlideId={slide.id}
            horizontal={phone}
            onSelect={openSlide}
            onAdd={(kind: DeckSlideKind) => {
              const added = newSlide(
                kind,
                style,
                placeholders,
                deck.width,
                deck.height,
              )
              const index = deck.slides.indexOf(slide) + 1
              change({ type: 'slide/add', slides: [added], index })
              openSlide(added.id)
            }}
            onDuplicate={(id) =>
              change({ type: 'slide/duplicate', slideId: id })
            }
            onDelete={(id) => change({ type: 'slide/remove', slideId: id })}
            onMove={(from, to) => change({ type: 'slide/move', from, to })}
          />
        </div>
        <main className="min-h-0 min-w-0 flex-1 p-3 sm:p-6">
          <DeckCanvas
            deck={deck}
            slide={slide}
            selectedId={selectedId}
            onSelect={select}
            change={change}
            editingId={editingId}
            onEditText={setEditingId}
            onTextEditor={setTextEditor}
            preview={preview.shown}
          />
        </main>
        <DeckEditorPanel
          slide={slide}
          selected={selected}
          onSelect={select}
          editor={editingId === selectedId ? textEditor : null}
          change={change}
          onPreview={preview.start}
          previewing={!!preview.shown}
          sheet={phone}
        />
      </div>
      <PptxImportDialog pptx={pptx} />
      {picking && (
        <MediaPickerDialog
          kind={picking}
          onClose={() => setPicking(null)}
          onPick={(selection) =>
            insert({
              type: selection.kind === 'video' ? 'video' : 'image',
              mediaId: mediaIdOf(selection.url),
            })
          }
        />
      )}
    </div>
  )
}
