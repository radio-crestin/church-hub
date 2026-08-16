import { useCallback, useLayoutEffect, useRef } from 'react'

import { calculateFontSize } from './utils/calculateFontSize'
import { getTextStyles } from './utils/getTextStyles'
import { normalizeText } from './utils/normalizeText'
import { sanitizePastedText } from './utils/sanitizePastedText'
import { attachRepetitionMarkers } from '../../../../utils/attachRepetitionMarkers'
import type { TextStyle } from '../../types'

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
}: EditableMainTextProps) {
  const editRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const seededKeyRef = useRef<string | null>(null)

  // The editor shows the same glued markers the projection does, but the text
  // handed back to the caller gets plain spaces again so nothing stores a
  // non-breaking space in the slide HTML.
  const normalizedText = attachRepetitionMarkers(normalizeText(content, true))

  // Recompute the auto-scaled font size to fit the current text in the box.
  const fit = useCallback(() => {
    if (!measureRef.current || !editRef.current) return
    const fontSize = calculateFontSize(
      measureRef.current,
      editRef.current.innerText,
      width,
      height,
      style.maxFontSize,
      style.minFontSize ?? 12,
    )
    editRef.current.style.fontSize = `${fontSize}px`
  }, [width, height, style.maxFontSize, style.minFontSize])

  // Seed the editable text only when switching to a different slide. While the
  // same slide is being edited we leave the DOM alone so the caret is preserved.
  useLayoutEffect(() => {
    if (!editRef.current) return
    if (seededKeyRef.current !== editKey) {
      editRef.current.innerText = normalizedText
      seededKeyRef.current = editKey
    }
    fit()
  }, [editKey, normalizedText, fit])

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

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
  }

  const editableStyle: React.CSSProperties = {
    ...textStyles,
    fontSize: `${style.maxFontSize}px`, // overwritten by fit()
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: verticalAlign,
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
