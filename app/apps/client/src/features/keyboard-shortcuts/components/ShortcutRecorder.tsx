import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useShortcutRecordingOptional } from '../context'
import { useMIDIOptional } from '../midi/context'
import { isMIDIShortcut, midiMessageToShortcutString } from '../midi/utils'
import { formatShortcutForDisplay, isModifierKey } from '../utils'

interface ShortcutRecorderProps {
  value: string
  onChange: (shortcut: string) => void
  onRemove: () => void
  error?: string
  namespace?: string
}

export function ShortcutRecorder({
  value,
  onChange,
  onRemove,
  error,
  namespace = 'settings',
}: ShortcutRecorderProps) {
  const { t } = useTranslation(namespace)
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(isRecording)
  const onChangeRef = useRef(onChange)
  const midi = useMIDIOptional()
  const recording = useShortcutRecordingOptional()

  // Keep refs in sync with state/props
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Subscribe to MIDI messages when recording
  useEffect(() => {
    if (!isRecording || !midi || !midi.isEnabled) return

    const unsubscribe = midi.subscribe((message) => {
      // Only capture note_on or control_change with value > 0
      if (message.type === 'note_off') return
      if (message.type === 'control_change' && message.value === 0) return

      const shortcutString = midiMessageToShortcutString(message)
      if (shortcutString) {
        onChangeRef.current(shortcutString)
        setIsRecording(false)
        recording?.stopRecording()
      }
    })

    return unsubscribe
  }, [isRecording, midi, recording])

  const translationPrefix =
    namespace === 'livestream' ? 'scenes' : 'sections.shortcuts'

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Use ref to get current recording state (avoids stale closure)
      if (!isRecordingRef.current) return

      const parts: string[] = []

      if (e.metaKey || e.ctrlKey) {
        parts.push('CommandOrControl')
      }
      if (e.altKey) {
        parts.push('Alt')
      }
      if (e.shiftKey) {
        parts.push('Shift')
      }

      if (!isModifierKey(e.key)) {
        const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
        parts.push(key)
      }

      if (parts.length > 0 && !isModifierKey(e.key)) {
        onChangeRef.current(parts.join('+'))
        setIsRecording(false)
        recording?.stopRecording()
      }
    },
    [recording],
  )

  const handleFocus = useCallback(() => {
    setIsRecording(true)
    recording?.startRecording()
  }, [recording])

  const handleBlur = useCallback(() => {
    setIsRecording(false)
    recording?.stopRecording()
  }, [recording])

  // Determine if current value is a MIDI shortcut
  const isMIDI = value && isMIDIShortcut(value)

  // Get recording placeholder based on MIDI availability
  const getRecordingPlaceholder = () => {
    if (!isRecording) {
      return t(`${translationPrefix}.clickToRecord`, {
        defaultValue: 'Click to record',
      })
    }
    if (midi?.isEnabled) {
      return t(`${translationPrefix}.recordShortcutOrMidi`, {
        defaultValue: 'Press key or MIDI button...',
      })
    }
    return t(`${translationPrefix}.recordShortcut`)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        {/* MIDI badge indicator */}
        {isMIDI && !isRecording && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            MIDI
          </span>
        )}
        <input
          type="text"
          readOnly
          value={value ? formatShortcutForDisplay(value) : ''}
          placeholder={getRecordingPlaceholder()}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`
            w-full py-2 text-sm
            border rounded-lg
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2
            cursor-pointer
            ${isMIDI && !isRecording ? 'pl-14 pr-3' : 'px-3'}
            ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : isRecording
                  ? 'border-indigo-500 focus:ring-indigo-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'
            }
          `}
        />
        {isRecording && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-500 animate-pulse">
            {t(`${translationPrefix}.recording`, {
              defaultValue: 'Recording...',
            })}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title={t(`${translationPrefix}.removeShortcut`)}
      >
        <X size={18} />
      </button>
    </div>
  )
}
