import { useEffect, useState } from 'react'

import { useMixerConfig } from './useMixerConfig'
import { testMixerConnection } from '../service/mixer'

const CONNECTION_CHECK_INTERVAL_MS = 5000
const RECONNECT_RETRY_INTERVAL_MS = 1000

/**
 * Whether the enabled mixer answers: checked every 5 s while it does, every
 * second while it doesn't. Never connected while the mixer is off.
 */
export function useMixerConnectionStatus() {
  const { config } = useMixerConfig()
  const [isConnected, setIsConnected] = useState(false)
  const isEnabled = config?.isEnabled ?? false
  const host = config?.host

  useEffect(() => {
    if (!isEnabled || !host) {
      setIsConnected(false)
      return
    }

    let isMounted = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const runCheck = async () => {
      const connected = await testMixerConnection()
        .then((result) => result.success)
        .catch(() => false)
      if (!isMounted) return
      setIsConnected(connected)
      timer = setTimeout(
        runCheck,
        connected ? CONNECTION_CHECK_INTERVAL_MS : RECONNECT_RETRY_INTERVAL_MS,
      )
    }
    runCheck()

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [isEnabled, host])

  return { isEnabled, isConnected }
}
