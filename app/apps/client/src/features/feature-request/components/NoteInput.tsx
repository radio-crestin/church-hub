import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const NOTE_MAX_LENGTH = 200
const INPUT_WIDTH_PX = 240

interface NoteInputProps {
  /** Where the user clicked, in CSS pixels inside the screenshot box. */
  left: number
  top: number
  /** Width of the screenshot box, to keep the input inside it. */
  boxWidth: number
  onSave: (text: string) => void
  onCancel: () => void
}

/**
 * A small text box at the clicked spot on the screenshot. Enter (or
 * clicking away) keeps the note, Escape drops it without closing the dialog.
 */
export function NoteInput({
  left,
  top,
  boxWidth,
  onSave,
  onCancel,
}: NoteInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const width = Math.min(INPUT_WIDTH_PX, boxWidth)
  // Escape removes the box, which can still fire a blur: act only once.
  const isDone = useRef(false)
  const close = (save: boolean) => {
    if (isDone.current) return
    isDone.current = true
    if (save && text.trim()) onSave(text.trim())
    else onCancel()
  }

  return (
    <input
      autoFocus
      data-testid="feature-request-note-input"
      value={text}
      maxLength={NOTE_MAX_LENGTH}
      placeholder={t('common:featureRequest.notePlaceholder')}
      aria-label={t('common:featureRequest.toolNote')}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => close(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          close(true)
        }
        if (event.key === 'Escape') {
          // Keeps the dialog open: Escape only drops this note.
          event.preventDefault()
          event.stopPropagation()
          close(false)
        }
      }}
      className="absolute z-10 px-2 py-1 text-sm rounded-md border-2 border-red-500 bg-white text-gray-900 shadow-lg focus:outline-none"
      style={{
        left: Math.max(0, Math.min(left, boxWidth - width)),
        top: Math.max(0, top - 16),
        width,
      }}
    />
  )
}
