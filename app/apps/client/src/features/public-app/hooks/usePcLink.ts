import { useEffect, useState } from 'react'

import { installTunnel, setTunnelOpen } from '~/features/remote-access'
import type { ChurchBinding } from '../service/churchBinding'
import { connectToPc } from '../service/connectToPc'
import { PC_API_ORIGIN } from '../service/pcApiOrigin'

/**
 * How the phone reaches its church now: `live` over WebRTC to the PC, the
 * `cloud` (the bucket) while the PC is off or out of reach.
 */
export type PcLink = 'connecting' | 'live' | 'cloud'

/** While on the cloud, the PC is looked for again this often. */
const RETRY_MS = 30_000

/**
 * Connects to the church PC over WebRTC when the join link named its room,
 * falls back to the cloud, and tries the PC again while the app is open.
 */
export function usePcLink(binding: ChurchBinding): PcLink {
  const [link, setLink] = useState<PcLink>(
    binding.pcSignalId ? 'connecting' : 'cloud',
  )

  useEffect(() => {
    if (!binding.pcSignalId) return
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let close: (() => void) | undefined

    const toCloud = () => {
      setLink('cloud')
      retry = setTimeout(connect, RETRY_MS)
    }
    async function connect() {
      const tunnel = await connectToPc(binding)
      if (stopped) {
        tunnel?.close()
        return
      }
      if (!tunnel) return toCloud()
      installTunnel(tunnel, PC_API_ORIGIN)
      close = () => tunnel.close()
      tunnel.onClose(() => {
        setTunnelOpen(false)
        if (!stopped) toCloud()
      })
      setLink('live')
    }

    void connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      close?.()
    }
  }, [binding])

  return link
}
