import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { openAuthUrl } from '~/features/livestream/utils'
import { type OwnerSignInIntent, startOwnerSignIn } from '../service'
import { syncStatusQueryKey } from '../../hooks/useSyncStatus'

/** How often the status is read while the browser sign-in is open. */
const POLL_MS = 1500
/** The sign-in is given up on after this long. */
const SIGN_IN_TIMEOUT_MS = 3 * 60 * 1000

/**
 * Opens the Google sign-in in the browser and watches the sync status until
 * what it was for has happened (`isDone`, from the latest status). Returns
 * the intent being signed in for while waiting, else null.
 */
export function useOwnerSignIn(isDone: (intent: OwnerSignInIntent) => boolean) {
  const queryClient = useQueryClient()
  const [waitingFor, setWaitingFor] = useState<OwnerSignInIntent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const done = waitingFor !== null && isDone(waitingFor)

  useEffect(() => {
    if (!waitingFor) return
    if (done) {
      setWaitingFor(null)
      return
    }
    const poll = setInterval(
      () => queryClient.invalidateQueries({ queryKey: syncStatusQueryKey }),
      POLL_MS,
    )
    const giveUp = setTimeout(() => setWaitingFor(null), SIGN_IN_TIMEOUT_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [waitingFor, done, queryClient])

  const signIn = useCallback(async (intent: OwnerSignInIntent) => {
    setError(null)
    try {
      const { authUrl } = await startOwnerSignIn(intent)
      setWaitingFor(intent)
      await openAuthUrl(authUrl, { popupName: 'church-hub-owner' })
    } catch (failure) {
      setWaitingFor(null)
      setError(failure instanceof Error ? failure.message : 'sign_in_failed')
    }
  }, [])

  return { signIn, waitingFor, error }
}
