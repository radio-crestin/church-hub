/**
 * Global recording state module
 *
 * This module provides a simple global state for tracking whether any
 * ShortcutRecorder is currently active. This is used by keyboard shortcut
 * handlers to skip execution during recording.
 *
 * We use a module-level variable instead of React context because:
 * - Multiple ShortcutRecordingProvider instances exist (in modals)
 * - Tauri shortcut callbacks need synchronous access to recording state
 * - This avoids the context hierarchy issues with nested providers
 */

import { useSyncExternalStore } from 'react'

let isRecording = false
const subscribers = new Set<() => void>()

/**
 * Set the global recording state
 * Called by ShortcutRecorder on focus/blur
 */
export function setGlobalRecordingState(recording: boolean): void {
  if (isRecording !== recording) {
    isRecording = recording
    // Notify all subscribers
    for (const callback of subscribers) {
      callback()
    }
  }
}

/**
 * Check if any shortcut recorder is currently recording
 * Called by keyboard shortcut handlers to skip execution
 */
export function isGlobalRecordingActive(): boolean {
  return isRecording
}

/**
 * Subscribe to recording state changes
 * Used internally by useGlobalRecordingState hook
 */
function subscribe(callback: () => void): () => void {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

/**
 * Get a snapshot of the current recording state
 */
function getSnapshot(): boolean {
  return isRecording
}

/**
 * React hook to subscribe to global recording state changes
 * Returns the current recording state and re-renders when it changes
 */
export function useGlobalRecordingState(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
