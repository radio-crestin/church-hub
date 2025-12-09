import { useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean
}

export function useUnsavedChangesGuard({
  isDirty,
}: UseUnsavedChangesGuardOptions) {
  const [showModal, setShowModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null)

  // TanStack Router navigation blocking
  const { proceed, reset, status } = useBlocker({
    condition: isDirty,
  })

  // Show modal when blocked
  useEffect(() => {
    if (status === 'blocked') {
      setShowModal(true)
      setPendingNavigation(() => proceed)
    }
  }, [status, proceed])

  // Browser beforeunload handler for browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        // Required for Chrome - setting returnValue shows native browser dialog
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleCancel = useCallback(() => {
    setShowModal(false)
    setPendingNavigation(null)
    reset?.()
  }, [reset])

  const handleDiscard = useCallback(() => {
    setShowModal(false)
    pendingNavigation?.()
    setPendingNavigation(null)
  }, [pendingNavigation])

  return {
    showModal,
    handleCancel,
    handleDiscard,
  }
}
