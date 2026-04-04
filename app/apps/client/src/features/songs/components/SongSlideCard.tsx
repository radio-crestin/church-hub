import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Copy,
  GripVertical,
  Music,
  Redo2,
  Tag,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChordMapping } from '../types'

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
  onContentChange: (content: string) => void
  onChordsChange: (chords: ChordMapping[] | null) => void
  onLabelChange: (label: string | null) => void
  onClone: () => void
  onDelete: () => void
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
  const text = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .trim()

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
  onContentChange,
  onChordsChange,
  onLabelChange,
  onClone,
  onDelete,
}: SongSlideCardProps) {
  const { t } = useTranslation('songs')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showChordEditor, setShowChordEditor] = useState(false)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
    null,
  )
  const [chordFilter, setChordFilter] = useState('')
  const chordPickerRef = useRef<HTMLDivElement>(null)
  const labelPickerRef = useRef<HTMLDivElement>(null)

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
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Header with drag handle, label and actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </button>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('editor.slideNumber', { number: index + 1 })}
          </span>

          {/* Label picker */}
          <div className="relative" ref={labelPickerRef}>
            <button
              type="button"
              onClick={() => setShowLabelPicker(!showLabelPicker)}
              className={`ml-1 px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                slide.label
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={t('chords.setLabel')}
            >
              {slide.label || <Tag className="w-3 h-3" />}
            </button>
            {showLabelPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 p-2 min-w-[120px]">
                <div className="grid grid-cols-2 gap-1">
                  {SLIDE_LABELS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onLabelChange(slide.label === label ? null : label)
                        setShowLabelPicker(false)
                      }}
                      className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                        slide.label === label
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                    className="w-full mt-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    {t('chords.removeLabel')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowChordEditor(!showChordEditor)}
            className={`p-1.5 rounded transition-colors ${
              showChordEditor
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={t('chords.editChords')}
          >
            <Music className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
          <button
            type="button"
            onClick={onClone}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title={t('actions.cloneSlide')}
          >
            <Copy className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
            title={t('actions.delete')}
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Chord Editor */}
      {showChordEditor && (
        <div className="px-3 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-gray-200 dark:border-gray-700">
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
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-red-500 dark:hover:text-red-400 transition-colors leading-tight"
                      title={t('chords.removeChord')}
                    >
                      {chord}
                    </button>
                  )}
                  {!chord && <div className="h-[15px]" />}
                  {/* Clickable word */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWordIndex(isSelected ? null : wordIdx)
                      setChordFilter('')
                    }}
                    className={`px-1 py-0.5 text-sm rounded transition-colors ${
                      isSelected
                        ? 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100'
                        : chord
                          ? 'bg-amber-100/50 dark:bg-amber-900/30 text-gray-800 dark:text-gray-200'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                    }`}
                  >
                    {word}
                  </button>

                  {/* Chord picker dropdown */}
                  {isSelected && (
                    <div
                      ref={chordPickerRef}
                      className="absolute top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 p-2 min-w-[200px]"
                    >
                      <input
                        type="text"
                        value={chordFilter}
                        onChange={(e) => setChordFilter(e.target.value)}
                        placeholder={t('chords.searchChord')}
                        className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded mb-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && filteredChords.length > 0) {
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
                            className="px-1.5 py-1 text-xs font-medium rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-gray-700 dark:text-gray-300 transition-colors"
                          >
                            {chord}
                          </button>
                        ))}
                      </div>
                      {chordFilter && filteredChords.length === 0 && (
                        <button
                          type="button"
                          onClick={() => handleAssignChord(chordFilter)}
                          className="w-full mt-1 px-2 py-1 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                        >
                          {t('chords.useCustom', { chord: chordFilter })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {slide.chords && slide.chords.length > 0 && (
            <button
              type="button"
              onClick={() => onChordsChange(null)}
              className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('chords.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* Editor Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2.5 py-1 rounded text-sm font-bold ${
            editor?.isActive('bold')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2.5 py-1 rounded text-sm font-medium italic ${
            editor?.isActive('italic')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          I
        </button>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`px-2.5 py-1 rounded text-sm font-medium ${
            editor?.isActive('heading', { level: 1 })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`px-2.5 py-1 rounded text-sm font-medium ${
            editor?.isActive('heading', { level: 2 })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          H2
        </button>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          className={`px-2.5 py-1 rounded text-sm ${
            editor?.isActive({ textAlign: 'left' })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          className={`px-2.5 py-1 rounded text-sm ${
            editor?.isActive({ textAlign: 'center' })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          ↔
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          className={`px-2.5 py-1 rounded text-sm ${
            editor?.isActive({ textAlign: 'right' })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          →
        </button>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.undo')}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.redo')}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content */}
      <div className="bg-gray-50 dark:bg-gray-900/50">
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
        />
      </div>
    </div>
  )
}
