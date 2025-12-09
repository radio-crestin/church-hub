import { useCallback, useRef } from 'react'

interface LocalItem {
  id: number
}

interface ScheduleState {
  title: string
  description: string
  items: LocalItem[]
}

function areStatesEqual(a: ScheduleState, b: ScheduleState): boolean {
  if (a.title !== b.title) return false
  if (a.description !== b.description) return false
  if (a.items.length !== b.items.length) return false

  for (let i = 0; i < a.items.length; i++) {
    const aItem = a.items[i]
    const bItem = b.items[i]
    if (!aItem || !bItem || aItem.id !== bItem.id) return false
  }

  return true
}

export function useDirtyState() {
  const savedStateRef = useRef<ScheduleState | null>(null)

  const setSavedState = useCallback((state: ScheduleState) => {
    savedStateRef.current = {
      title: state.title,
      description: state.description,
      items: state.items.map((item) => ({ id: item.id })),
    }
  }, [])

  const isDirty = useCallback((currentState: ScheduleState): boolean => {
    // New schedule without saved state is dirty if it has a title
    if (!savedStateRef.current) {
      return currentState.title.trim().length > 0
    }

    const normalizedCurrent: ScheduleState = {
      title: currentState.title,
      description: currentState.description,
      items: currentState.items.map((item) => ({ id: item.id })),
    }

    return !areStatesEqual(normalizedCurrent, savedStateRef.current)
  }, [])

  const resetSavedState = useCallback(() => {
    savedStateRef.current = null
  }, [])

  return { setSavedState, isDirty, resetSavedState }
}
