import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useWebSocket } from '~/features/presentation/hooks'
import { ShortcutScopeToggle } from './ShortcutScopeToggle'
import { useShortcutRecordingOptional } from '../context'
import { useMIDIOptional } from '../midi/context'
import { isMIDIShortcut, midiMessageToShortcutString } from '../midi/utils'
import type { ShortcutKind } from '../types'
import {
  formatShortcutForDisplay,
  setGlobalRecordingState,
  shortcutFromKeyboardEvent,
} from '../utils'

interface ShortcutRecorderProps {
  value: string
  onChange: (shortcut: string) => void
  onRemove: () => void
  error?: string
  namespace?: string
  /**
   * Whether a MIDI button may be recorded here (default true). Off for
   * bindings only the client can act on — MIDI is dispatched by the server.
   */
  allowMidi?: boolean
  /**
   * What the key does. Given, a recorded keyboard key gets a switch for where
   * it works: only in Church Hub, or from any program.
   */
  scopeKind?: ShortcutKind
}

export function ShortcutRecorder({
  value,
  onChange,
  onRemove,
  error,
  namespace = 'settings',
  allowMidi = true,
  scopeKind,
}: ShortcutRecorderProps) {
  const { t } = useTranslation(namespace)
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(isRecording)
  const onChangeRef = useRef(onChange)
  const midi = useMIDIOptional()
  const recording = useShortcutRecordingOptional()
  const { send: sendWs } = useWebSocket()

  // Keep refs in sync with state/props
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Subscribe to MIDI messages when recording
  useEffect(() => {
    if (!isRecording || !midi || !allowMidi) return

    // Request MIDI access to ensure WebSocket is connected for recording
    // This works even if MIDI is not globally enabled - we still want to capture shortcuts
    midi.requestAccess()

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
  }, [isRecording, midi, recording, allowMidi])

  const translationPrefix =
    namespace === 'livestream' ? 'scenes' : 'sections.shortcuts'

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Use ref to get current recording state (avoids stale closure)
      if (!isRecordingRef.current) return

      const shortcut = shortcutFromKeyboardEvent(e)
      if (shortcut) {
        onChangeRef.current(shortcut)
        setIsRecording(false)
        recording?.stopRecording()
      }
    },
    [recording],
  )

  const handleFocus = useCallback(() => {
    setIsRecording(true)
    recording?.startRecording()
    // Set global state for keyboard shortcuts (client-side Tauri handlers)
    setGlobalRecordingState(true)
    // Notify server to pause MIDI shortcut execution during recording
    sendWs({ type: 'shortcut_recording_start' })
  }, [recording, sendWs])

  const handleBlur = useCallback(() => {
    setIsRecording(false)
    recording?.stopRecording()
    // Clear global state for keyboard shortcuts
    setGlobalRecordingState(false)
    // Notify server to resume MIDI shortcut execution
    sendWs({ type: 'shortcut_recording_stop' })
  }, [recording, sendWs])

  // Determine if current value is a MIDI shortcut
  const isMIDI = value && isMIDIShortcut(value)

  // Get recording placeholder based on MIDI availability
  const getRecordingPlaceholder = () => {
    if (!isRecording) {
      return t(`${translationPrefix}.clickToRecord`, {
        defaultValue: 'Click to record',
      })
    }
    if (midi?.isEnabled && allowMidi) {
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
          <span className="absolute left-2 top-1/2 -translate-y-1/2 px-[5px] h-[18px] leading-[18px] text-[11px] font-medium bg-keycap shadow-[inset_0_0_0_1px_var(--color-keycap-ring)] text-fg-label rounded-[5px]">
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
            w-full h-9 text-[13px]
            border rounded-[10px]
            bg-field
            text-fg
            placeholder:text-fg-hint
            focus:outline-none focus:ring-1 focus:ring-inset
            cursor-pointer
            ${isMIDI && !isRecording ? 'pl-14 pr-3' : 'px-3'}
            ${
              error
                ? 'border-red-600 focus:ring-red-600'
                : isRecording
                  ? 'border-focus focus:ring-focus'
                  : 'border-transparent focus:border-focus focus:ring-focus'
            }
          `}
        />
        {isRecording && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-hint">
            {t(`${translationPrefix}.recording`, {
              defaultValue: 'Recording...',
            })}
          </span>
        )}
      </div>
      {scopeKind && value && !isMIDI && (
        <ShortcutScopeToggle shortcut={value} kind={scopeKind} />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="h-8 w-8 inline-flex items-center justify-center text-fg-label hover:text-red-600 dark:hover:text-red-400 hover:bg-hover rounded-lg transition-colors"
        title={t(`${translationPrefix}.removeShortcut`)}
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
