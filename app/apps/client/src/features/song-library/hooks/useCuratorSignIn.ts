import { useCallback, useEffect, useState } from 'react'

import { openAuthUrl } from '~/features/livestream/utils'
import { startOwnerSignIn } from '~/features/sync/cloud/service'
import { useCuratorStatus } from './useCuratorStatus'

/** The sign-in is given up on after this long. */
const SIGN_IN_TIMEOUT_MS = 3 * 60 * 1000

/**
 * The curator's Google sign-in (the owner sign-in, intent `curate`): opens
 * it in the browser and watches the curator status until someone is in.
 */
export function useCuratorSignIn() {
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = useCuratorStatus(waiting)
  const signedIn = status.data?.signedIn ?? false

  useEffect(() => {
    if (!waiting) return
    if (signedIn) {
      setWaiting(false)
      return
    }
    const giveUp = setTimeout(() => setWaiting(false), SIGN_IN_TIMEOUT_MS)
    return () => clearTimeout(giveUp)
  }, [waiting, signedIn])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      const { authUrl } = await startOwnerSignIn('curate')
      setWaiting(true)
      await openAuthUrl(authUrl, { popupName: 'church-hub-owner' })
    } catch (failure) {
      setWaiting(false)
      setError(failure instanceof Error ? failure.message : 'sign_in_failed')
    }
  }, [])

  return { status, signIn, waiting, error }
}
