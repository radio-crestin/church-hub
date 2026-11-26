import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Copy,
  GripVertical,
  Music,
  Play,
  Redo2,
  Tag,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { decodeHtmlEntities } from '~/utils/decodeHtmlEntities'
import { removeHtmlTags } from '~/utils/removeHtmlTags'
import type { ChordMapping } from '../types'
import { localizeChordName } from '../utils/localizeChordName'

interface LocalSlide {
  id: string | number
  content: string
  chords?: ChordMapping[] | null
  sortOrder: number
  label?: string | null
}

interface SongSlideCardProps {
  slide: LocalSlide
  index: number
  isPresented?: boolean
  onContentChange: (content: string) => void
  onChordsChange: (chords: ChordMapping[] | null) => void
  onLabelChange: (label: string | null) => void
  onClone: () => void
  onDelete: () => void
  onPresent?: () => void
}

const SLIDE_LABELS = [
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'C1',
  'C2',
  'C3',
  'Bridge',
  'Pre-Chorus',
  'Outro',
  'Intro',
  'Tag',
]

const COMMON_CHORDS = [
  // Major
  'C',
  'D',
  'E',
  'F',
  'G',
  'A',
  'B',
  // Minor
  'Am',
  'Bm',
  'Cm',
  'Dm',
  'Em',
  'Fm',
  'Gm',
  // Sharp Major
  'C#',
  'D#',
  'F#',
  'G#',
  'A#',
  // Flat Major
  'Db',
  'Eb',
  'Gb',
  'Ab',
  'Bb',
  // Sharp Minor
  'C#m',
  'D#m',
  'F#m',
  'G#m',
  'A#m',
  // Flat Minor
  'Dbm',
  'Ebm',
  'Gbm',
  'Abm',
  'Bbm',
  // 7th
  'C7',
  'D7',
  'E7',
  'F7',
  'G7',
  'A7',
  'B7',
  // Minor 7th
  'Am7',
  'Bm7',
  'Cm7',
  'Dm7',
  'Em7',
  'Fm7',
  'Gm7',
  // Suspended
  'Csus2',
  'Dsus2',
  'Gsus2',
  'Asus2',
  'Csus4',
  'Dsus4',
  'Gsus4',
  'Asus4',
  // Diminished / Augmented
  'Cdim',
  'Ddim',
  'Edim',
  'Fdim',
  'Gdim',
  'Adim',
  'Bdim',
  'Caug',
  'Daug',
  'Eaug',
  'Faug',
  'Gaug',
  'Aaug',
  'Baug',
]

/** Extract plain text words from HTML content */
function getWordsFromHtml(html: string): string[] {
  const lines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const text = decodeHtmlEntities(removeHtmlTags(lines)).trim()

  if (!text) return []

  // Split into words, preserving newlines as tokens
  const tokens: string[] = []
  for (const line of text.split('\n')) {
    const lineWords = line.split(/\s+/).filter(Boolean)
    tokens.push(...lineWords)
    tokens.push('\n')
  }
  // Remove trailing newline
  if (tokens[tokens.length - 1] === '\n') tokens.pop()
  return tokens
}

export function SongSlideCard({
  slide,
  index,
  isPresented = false,
  onContentChange,
  onChordsChange,
  onLabelChange,
  onClone,
  onDelete,
  onPresent,
}: SongSlideCardProps) {
  const { t, i18n } = useTranslation('songs')
  const language = i18n.language?.split('-')[0] || 'en'
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showChordEditor, setShowChordEditor] = useState(false)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
    null,
  )
  const [chordFilter, setChordFilter] = useState('')
  const [labelPickerPos, setLabelPickerPos] = useState<{
    top: number
    left: number
  } | null>(null)
  const [chordPickerPos, setChordPickerPos] = useState<{
    top: number
    left: number
  } | null>(null)
  const chordPickerRef = useRef<HTMLDivElement>(null)
  const labelPickerRef = useRef<HTMLDivElement>(null)
  const labelBtnRef = useRef<HTMLButtonElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: slide.content,
    editorProps: {
      attributes: {
        class: 'min-h-[100px] p-4 focus:outline-none',
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && slide.content !== editor.getHTML()) {
      editor.commands.setContent(slide.content)
    }
  }, [editor, slide.content])

  // Close pickers on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        chordPickerRef.current &&
        !chordPickerRef.current.contains(e.target as Node)
      ) {
        setSelectedWordIndex(null)
        setChordFilter('')
      }
      if (
        labelPickerRef.current &&
        !labelPickerRef.current.contains(e.target as Node)
      ) {
        setShowLabelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const words = useMemo(() => getWordsFromHtml(slide.content), [slide.content])
  const chordMap = useMemo(() => {
    const map = new Map<number, string>()
    if (slide.chords) {
      for (const c of slide.chords) {
        map.set(c.wordIndex, c.chord)
      }
    }
    return map
  }, [slide.chords])

  const handleAssignChord = useCallback(
    (chord: string) => {
      if (selectedWordIndex === null) return
      const existing =
        slide.chords?.filter((c) => c.wordIndex !== selectedWordIndex) ?? []
      onChordsChange([...existing, { wordIndex: selectedWordIndex, chord }])
      setSelectedWordIndex(null)
      setChordFilter('')
    },
    [selectedWordIndex, slide.chords, onChordsChange],
  )

  const handleRemoveChord = useCallback(
    (wordIndex: number) => {
      const updated =
        slide.chords?.filter((c) => c.wordIndex !== wordIndex) ?? []
      onChordsChange(updated.length > 0 ? updated : null)
    },
    [slide.chords, onChordsChange],
  )

  const filteredChords = useMemo(() => {
    if (!chordFilter) return COMMON_CHORDS
    const lower = chordFilter.toLowerCase()
    return COMMON_CHORDS.filter((c) => c.toLowerCase().includes(lower))
  }, [chordFilter])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-panel border rounded-xl overflow-hidden ${
        isPresented ? 'border-transparent ring-1 ring-live' : 'border-line'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Header with drag handle, label and actions */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-fg-hint hover:text-fg-label rounded transition-colors"
          >
            <GripVertical className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-sm font-medium text-fg-label">
            {t('editor.slideNumber', { number: index + 1 })}
          </span>

          {/* Label picker */}
          <div ref={labelPickerRef}>
            <button
              ref={labelBtnRef}
              type="button"
              onClick={() => {
                if (showLabelPicker) {
                  setShowLabelPicker(false)
                } else {
                  const rect = labelBtnRef.current?.getBoundingClientRect()
                  if (rect) {
                    setLabelPickerPos({ top: rect.bottom + 4, left: rect.left })
                  }
                  setShowLabelPicker(true)
                }
              }}
              className={`ml-1 px-1.5 py-0.5 rounded-md text-xs font-medium transition-colors ${
                slide.label
                  ? 'bg-field text-fg hover:bg-hover'
                  : 'text-fg-hint hover:bg-hover hover:text-fg'
              }`}
              title={t('chords.setLabel')}
            >
              {slide.label || <Tag className="w-3 h-3" />}
            </button>
            {showLabelPicker &&
              labelPickerPos &&
              createPortal(
                <div
                  className="fixed bg-panel border border-line rounded-[10px] shadow-popover z-[100] p-1.5 min-w-[120px]"
                  style={{
                    top: labelPickerPos.top,
                    left: labelPickerPos.left,
                  }}
                >
                  <div className="grid grid-cols-2 gap-1">
                    {SLIDE_LABELS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          onLabelChange(slide.label === label ? null : label)
                          setShowLabelPicker(false)
                        }}
                        className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                          slide.label === label
                            ? 'bg-selected text-fg'
                            : 'text-fg-label hover:bg-hover'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {slide.label && (
                    <button
                      type="button"
                      onClick={() => {
                        onLabelChange(null)
                        setShowLabelPicker(false)
                      }}
                      className="w-full mt-1 px-2 py-1 text-xs text-fg-label hover:bg-hover hover:text-red-600 rounded-md transition-colors"
                    >
                      {t('chords.removeLabel')}
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onPresent && (
            <button
              type="button"
              onClick={onPresent}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                isPresented
                  ? 'bg-live-tint text-live'
                  : 'text-fg-label hover:bg-hover hover:text-fg'
              }`}
              title={t('preview.presentSlide', 'Present this slide')}
            >
              <Play className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowChordEditor(!showChordEditor)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-fg-label transition-colors ${
              showChordEditor
                ? 'bg-selected text-fg'
                : 'hover:bg-hover hover:text-fg'
            }`}
            title={t('chords.editChords')}
          >
            <Music className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onClone}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg"
            title={t('actions.cloneSlide')}
          >
            <Copy className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-red-600"
            title={t('actions.delete')}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Chord Editor */}
      {showChordEditor && (
        <div className="px-3 py-3 bg-field border-b border-line">
          <div className="flex flex-wrap items-start gap-1 leading-relaxed">
            {words.map((word, wordIdx) => {
              if (word === '\n') {
                return <div key={`br-${wordIdx}`} className="w-full h-0" />
              }
              const chord = chordMap.get(wordIdx)
              const isSelected = selectedWordIndex === wordIdx
              return (
                <div
                  key={`${wordIdx}-${word}`}
                  className="relative flex flex-col items-center"
                >
                  {/* Chord above word */}
                  {chord && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChord(wordIdx)}
                      className="text-[11px] font-semibold text-key hover:text-red-600 transition-colors leading-tight"
                      title={t('chords.removeChord')}
                    >
                      {localizeChordName(chord, language)}
                    </button>
                  )}
                  {!chord && <div className="h-[15px]" />}
                  {/* Clickable word */}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (isSelected) {
                        setSelectedWordIndex(null)
                        setChordFilter('')
                      } else {
                        const rect = (
                          e.target as HTMLElement
                        ).getBoundingClientRect()
                        setChordPickerPos({
                          top: rect.bottom + 4,
                          left: rect.left,
                        })
                        setSelectedWordIndex(wordIdx)
                        setChordFilter('')
                      }
                    }}
                    className={`px-1 py-0.5 text-sm rounded transition-colors ${
                      isSelected
                        ? 'bg-selected text-fg'
                        : chord
                          ? 'bg-hover text-fg-body'
                          : 'text-fg-body hover:bg-hover'
                    }`}
                  >
                    {word}
                  </button>

                  {/* Chord picker dropdown (portal) */}
                  {isSelected &&
                    chordPickerPos &&
                    createPortal(
                      <div
                        ref={chordPickerRef}
                        className="fixed bg-panel border border-line rounded-[10px] shadow-popover z-[100] p-2 min-w-[200px]"
                        style={{
                          top: chordPickerPos.top,
                          left: chordPickerPos.left,
                        }}
                      >
                        <input
                          type="text"
                          value={chordFilter}
                          onChange={(e) => setChordFilter(e.target.value)}
                          placeholder={t('chords.searchChord')}
                          className="w-full h-8 px-2 text-sm border-0 rounded-lg mb-2 bg-field text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                          autoFocus
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' &&
                              filteredChords.length > 0
                            ) {
                              handleAssignChord(filteredChords[0])
                            }
                            if (e.key === 'Escape') {
                              setSelectedWordIndex(null)
                              setChordFilter('')
                            }
                          }}
                        />
                        <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
                          {filteredChords.map((chord) => (
                            <button
                              key={chord}
                              type="button"
                              onClick={() => handleAssignChord(chord)}
                              className="px-1.5 py-1 text-xs font-medium rounded-md hover:bg-hover text-fg-body transition-colors"
                            >
                              {localizeChordName(chord, language)}
                            </button>
                          ))}
                        </div>
                        {chordFilter && filteredChords.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleAssignChord(chordFilter)}
                            className="w-full mt-1 px-2 py-1 text-xs font-medium rounded-md bg-field text-fg hover:bg-hover transition-colors"
                          >
                            {t('chords.useCustom', { chord: chordFilter })}
                          </button>
                        )}
                      </div>,
                      document.body,
                    )}
                </div>
              )
            })}
          </div>
          {slide.chords && slide.chords.length > 0 && (
            <button
              type="button"
              onClick={() => onChordsChange(null)}
              className="mt-2 flex items-center gap-1 text-xs text-fg-label hover:text-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('chords.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* Editor Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 py-1.5 border-b border-line">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`h-7 px-2.5 rounded-md text-sm font-bold ${
            editor?.isActive('bold')
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`h-7 px-2.5 rounded-md text-sm font-medium italic ${
            editor?.isActive('italic')
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          I
        </button>
        <div className="w-px h-5 bg-line mx-1" />
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`h-7 px-2.5 rounded-md text-sm font-medium ${
            editor?.isActive('heading', { level: 1 })
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`h-7 px-2.5 rounded-md text-sm font-medium ${
            editor?.isActive('heading', { level: 2 })
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          H2
        </button>
        <div className="w-px h-5 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          className={`h-7 px-2.5 rounded-md text-sm ${
            editor?.isActive({ textAlign: 'left' })
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          className={`h-7 px-2.5 rounded-md text-sm ${
            editor?.isActive({ textAlign: 'center' })
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          ↔
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          className={`h-7 px-2.5 rounded-md text-sm ${
            editor?.isActive({ textAlign: 'right' })
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover'
          }`}
        >
          →
        </button>
        <div className="w-px h-5 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.undo')}
        >
          <Undo2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.redo')}
        >
          <Redo2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Editor Content */}
      <div>
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:text-fg-body"
        />
      </div>
    </div>
  )
}
