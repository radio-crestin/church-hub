import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { calculateFontSize } from './utils/calculateFontSize'
import { getTextStyles } from './utils/getTextStyles'
import { normalizeText } from './utils/normalizeText'
import { sanitizePastedText } from './utils/sanitizePastedText'
import { attachRepetitionMarkers } from '../../../../utils/attachRepetitionMarkers'
import type { TextStyle, TextStyleRange } from '../../types'
import { applyStylesToText } from '../../utils/applyStylesToText'

/** Character offsets of the current selection inside `root`. */
function selectionOffsets(
  root: HTMLElement,
): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const offsetOf = (node: Node, nodeOffset: number): number => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let offset = 0
    let current: Node | null = walker.nextNode()
    while (current) {
      if (current === node) return offset + nodeOffset
      offset += current.textContent?.length ?? 0
      current = walker.nextNode()
    }
    return offset
  }

  return {
    start: offsetOf(range.startContainer, range.startOffset),
    end: offsetOf(range.endContainer, range.endOffset),
  }
}

/** Puts the caret/selection back where it was after the DOM has been re-seeded. */
function restoreSelection(
  root: HTMLElement,
  offsets: { start: number; end: number },
): void {
  const locate = (target: number): { node: Node; offset: number } | null => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let seen = 0
    let current: Node | null = walker.nextNode()
    while (current) {
      const length = current.textContent?.length ?? 0
      if (seen + length >= target)
        return { node: current, offset: target - seen }
      seen += length
      current = walker.nextNode()
    }
    return current ? { node: current, offset: 0 } : null
  }

  const start = locate(offsets.start)
  const end = locate(offsets.end)
  if (!start || !end) return

  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

interface EditableMainTextProps {
  /** Current slide HTML content */
  content: string
  /** Text styling (maxFontSize already scaled to the preview by ScreenContent) */
  style: TextStyle
  /** Container width in pixels */
  width: number
  /** Container height in pixels */
  height: number
  /** Position left in pixels */
  left: number
  /** Position top in pixels */
  top: number
  /**
   * Identity key for the slide being edited. The editor only re-seeds its text
   * from `content` when this changes (i.e. the user navigates to another slide),
   * so typing never resets the caret.
   */
  editKey: string
  /** Placeholder shown when the slide is empty */
  placeholder?: string
  /** Called with the plain-text value (newline-separated lines) on every edit */
  onEdit: (plainText: string) => void
  /** Inline styling for runs of the slide's text (per-slide formatting). */
  styleRanges?: TextStyleRange[]
  /** Per-slide font multiplier, applied to the auto-fitted size. */
  contentScale?: number
}

/**
 * Editable variant of the projected main-text element. Reuses the exact same
 * font-fitting and text styling as the read-only renderer (AnimatedText) so the
 * operator edits lyrics directly on the slide, PowerPoint-style, and sees them at
 * the projected size and position. Only ever mounted by ScreenContent when the
 * stage editor enables editing — projection output is unaffected.
 */
export function EditableMainText({
  content,
  style,
  width,
  height,
  left,
  top,
  editKey,
  placeholder,
  onEdit,
  styleRanges,
  contentScale = 1,
}: EditableMainTextProps) {
  const editRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const seededKeyRef = useRef<string | null>(null)
  // The last run of text the operator actually selected here. Formatting is
  // applied from the toolbar, which takes focus away and collapses the live
  // selection, so this is what puts the selection back after the styled markup
  // is re-seeded — and what keeps the words selected for a second change.
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    const remember = () => {
      const editor = editRef.current
      const anchor = window.getSelection()?.anchorNode
      if (!editor || !anchor || !editor.contains(anchor)) return
      const offsets = selectionOffsets(editor)
      if (offsets && offsets.start !== offsets.end) {
        lastSelectionRef.current = offsets
      }
    }
    document.addEventListener('selectionchange', remember)
    return () => document.removeEventListener('selectionchange', remember)
  }, [])

  // The editor shows the same glued markers the projection does, but the text
  // handed back to the caller gets plain spaces again so nothing stores a
  // non-breaking space in the slide HTML.
  const normalizedText = attachRepetitionMarkers(normalizeText(content, true))

  // Recompute the auto-scaled font size to fit the current text in the box.
  const fit = useCallback(() => {
    if (!measureRef.current || !editRef.current) return
    const fontSize = calculateFontSize(
      measureRef.current,
      // What the editor reads back, not what the DOM happens to hold: a
      // contentEditable keeps a trailing line break and non-breaking spaces
      // that would measure as extra lines the slide does not have.
      editRef.current.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, ''),
      width,
      height,
      style.maxFontSize,
      style.minFontSize ?? 12,
    )
    editRef.current.style.fontSize = `${fontSize * contentScale}px`
  }, [width, height, style.maxFontSize, style.minFontSize, contentScale])

  // Styled runs are re-seeded as markup, so formatting a selection shows up in
  // the editor at once instead of only after leaving edit mode.
  const rangesKey = useMemo(
    () => JSON.stringify(styleRanges ?? []),
    [styleRanges],
  )

  // Seed the editable text when switching to a different slide, or when the
  // slide's inline styling changes. While the same slide is merely being typed
  // in we leave the DOM alone so the caret is preserved; on a styling change we
  // re-seed and put the selection back where the operator left it.
  useLayoutEffect(() => {
    const editor = editRef.current
    if (!editor) return

    const seedKey = `${editKey}|${rangesKey}`
    if (seededKeyRef.current !== seedKey) {
      const sameSlide = seededKeyRef.current?.startsWith(`${editKey}|`) === true
      const live = selectionOffsets(editor)
      // A collapsed caret means the toolbar took focus; the run the operator
      // had selected is the one to restore, not the caret.
      const selection = sameSlide
        ? live && live.start !== live.end
          ? live
          : (lastSelectionRef.current ?? live)
        : null

      if (styleRanges && styleRanges.length > 0) {
        editor.innerHTML = applyStylesToText(normalizedText, styleRanges)
      } else {
        editor.innerText = normalizedText
      }
      seededKeyRef.current = seedKey

      if (selection) restoreSelection(editor, selection)
    }
    fit()
  }, [editKey, rangesKey, normalizedText, styleRanges, fit])

  // A new slide starts with no remembered selection of its own.
  useEffect(() => {
    lastSelectionRef.current = null
  }, [editKey])

  const handleInput = useCallback(() => {
    if (!editRef.current) return
    fit()
    onEdit(editRef.current.innerText.replace(/\u00a0/g, ' '))
  }, [fit, onEdit])

  // Force a PLAIN-text paste. The browser's default paste inserts the
  // clipboard's rich HTML (nested blocks, &nbsp;, tabs, trailing empty
  // elements), which `innerText` then reads back as stray spaces/tabs/blank
  // lines between verses. Insert the sanitized plain text instead so the paste
  // keeps the copied form and nothing extra.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const raw =
        e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
      const text = sanitizePastedText(raw)
      if (!text) return

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(text)
      range.insertNode(node)
      // Drop the caret right after the inserted text.
      range.setStartAfter(node)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)

      handleInput()
    },
    [handleInput],
  )

  const textStyles = getTextStyles(style)
  const verticalAlign =
    style.verticalAlignment === 'top'
      ? 'flex-start'
      : style.verticalAlignment === 'bottom'
        ? 'flex-end'
        : 'center'

  // Vertical alignment lives on the container, not on the editable itself.
  // A contentEditable that is a flex container turns every element inside it
  // into a flex item, so each styled run and each line break became its own
  // full-width row: words split mid-line and the lines drifted apart. As a
  // plain block it lays text out exactly like the read-only renderer does.
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: verticalAlign,
  }

  const editableStyle: React.CSSProperties = {
    ...textStyles,
    // Carries the slide's own scale so the first paint matches the projection.
    fontSize: `${style.maxFontSize * contentScale}px`, // refined by fit()
    width: '100%',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    outline: 'none',
    cursor: 'text',
    caretColor: style.color,
  }

  const measureStyle: React.CSSProperties = {
    ...textStyles,
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: 'auto',
    height: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }

  const showPlaceholder = normalizedText.length === 0 && !!placeholder

  return (
    <div style={containerStyle}>
      <div ref={measureRef} style={measureStyle} aria-hidden="true" />
      <div
        ref={editRef}
        data-testid="slide-canvas-editable"
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={editableStyle}
        onInput={handleInput}
        onPaste={handlePaste}
      />
      {showPlaceholder && (
        <div
          style={{
            ...editableStyle,
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: verticalAlign,
            opacity: 0.4,
            pointerEvents: 'none',
            fontSize: `${Math.min(style.maxFontSize, 48)}px`,
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}
