import { useHistoryNavigationInput } from '../hooks/useHistoryNavigationInput'

/** Mounts the app-wide back / forward navigation by mouse and keyboard. */
export function HistoryNavigationManager() {
  useHistoryNavigationInput()
  return null
}
