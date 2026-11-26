import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { openAuthUrl } from '~/features/livestream/utils'
import { cloudBackupQueryKey } from './useCloudBackupQueries'
import { startCloudBackupSignIn } from '../service/cloudBackup'

/** How often the status is read while the browser sign-in is open. */
const POLL_MS = 1500
/** The sign-in is given up on after this long. */
const SIGN_IN_TIMEOUT_MS = 3 * 60 * 1000

/**
 * Opens the Google sign-in in the browser and polls the status meanwhile.
 * The signed-out card that uses it is replaced once the status says signed
 * in, which stops the polling; it also stops after a timeout.
 */
export function useCloudBackupSignIn() {
  const queryClient = useQueryClient()
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!waiting) return
    const poll = setInterval(
      () => queryClient.invalidateQueries({ queryKey: cloudBackupQueryKey }),
      POLL_MS,
    )
    const giveUp = setTimeout(() => setWaiting(false), SIGN_IN_TIMEOUT_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [waiting, queryClient])

  const signIn = useCallback(async () => {
    setFailed(false)
    try {
      const { authUrl } = await startCloudBackupSignIn()
      setWaiting(true)
      await openAuthUrl(authUrl, { popupName: 'church-hub-cloud-backup' })
    } catch {
      setWaiting(false)
      setFailed(true)
    }
  }, [])

  return { signIn, waiting, failed }
}
