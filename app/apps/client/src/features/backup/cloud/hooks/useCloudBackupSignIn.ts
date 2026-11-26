import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { openAuthUrl } from '~/features/livestream/utils'
import { cloudBackupQueryKey } from './useCloudBackupQueries'
import { startCloudBackupSignIn } from '../service/cloudBackup'

/** How often the status is read while the browser sign-in is open. */
const POLL_MS = 1500
/** The sign-in is given up on after this long. */
const SIGN_IN_TIMEOUT_MS = 3 * 60 * 1000

type SignInProblem = 'failed' | 'timedOut' | null

/**
 * Opens the Google sign-in in the browser and polls the status meanwhile.
 * The signed-out card that uses it is replaced once the status says signed
 * in, which stops the polling. The user can cancel the wait; after the
 * timeout it stops and says the sign-in wasn't finished.
 */
export function useCloudBackupSignIn() {
  const queryClient = useQueryClient()
  const [waiting, setWaiting] = useState(false)
  const [problem, setProblem] = useState<SignInProblem>(null)

  useEffect(() => {
    if (!waiting) return
    const poll = setInterval(
      () => queryClient.invalidateQueries({ queryKey: cloudBackupQueryKey }),
      POLL_MS,
    )
    const giveUp = setTimeout(() => {
      setWaiting(false)
      setProblem('timedOut')
    }, SIGN_IN_TIMEOUT_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [waiting, queryClient])

  const signIn = useCallback(async () => {
    setProblem(null)
    try {
      const { authUrl } = await startCloudBackupSignIn()
      setWaiting(true)
      await openAuthUrl(authUrl, { popupName: 'church-hub-cloud-backup' })
    } catch {
      setWaiting(false)
      setProblem('failed')
    }
  }, [])

  const cancel = useCallback(() => setWaiting(false), [])

  return { signIn, cancel, waiting, problem }
}
