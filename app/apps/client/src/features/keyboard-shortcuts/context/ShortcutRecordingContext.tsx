import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

interface ShortcutRecordingContextValue {
  /** Whether any recorder is currently active */
  isRecording: boolean
  /** Ref for synchronous access in callbacks (stable reference) */
  isRecordingRef: React.RefObject<boolean>
  /** Call when a ShortcutRecorder starts recording */
  startRecording: () => void
  /** Call when a ShortcutRecorder stops recording */
  stopRecording: () => void
}

const ShortcutRecordingContext =
  createContext<ShortcutRecordingContextValue | null>(null)

interface ShortcutRecordingProviderProps {
  children: React.ReactNode
}

export function ShortcutRecordingProvider({
  children,
}: ShortcutRecordingProviderProps) {
  // Counter to handle multiple concurrent recorders
  const [recordingCount, setRecordingCount] = useState(0)
  const isRecordingRef = useRef(false)

  // Keep ref in sync with state
  isRecordingRef.current = recordingCount > 0

  const startRecording = useCallback(() => {
    setRecordingCount((prev) => prev + 1)
  }, [])

  const stopRecording = useCallback(() => {
    setRecordingCount((prev) => Math.max(0, prev - 1))
  }, [])

  const value = useMemo<ShortcutRecordingContextValue>(
    () => ({
      isRecording: recordingCount > 0,
      isRecordingRef,
      startRecording,
      stopRecording,
    }),
    [recordingCount, startRecording, stopRecording],
  )

  return (
    <ShortcutRecordingContext.Provider value={value}>
      {children}
    </ShortcutRecordingContext.Provider>
  )
}

export function useShortcutRecording(): ShortcutRecordingContextValue {
  const context = useContext(ShortcutRecordingContext)
  if (!context) {
    throw new Error(
      'useShortcutRecording must be used within ShortcutRecordingProvider',
    )
  }
  return context
}

/**
 * Optional hook that returns null if not in provider
 * Useful for components that may or may not have recording tracking
 */
export function useShortcutRecordingOptional(): ShortcutRecordingContextValue | null {
  return useContext(ShortcutRecordingContext)
}
