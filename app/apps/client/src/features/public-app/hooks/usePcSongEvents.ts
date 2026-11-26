import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { PC_API_ORIGIN } from '../service/pcApiOrigin'

/** The PC drops a socket silent for 90 s; a ping keeps it. */
const PING_MS = 30_000
/** A dropped socket opens again after this, while the PC is reached. */
const REOPEN_MS = 2000
/** What the PC broadcasts when its songs changed (edited, or synced in). */
const SONG_EVENTS = new Set(['song_updated', 'sync_applied'])

/**
 * The PC's WebSocket events, over the tunnel while `live`: when a song
 * changed there (by anyone, on any device), the PC's songs are read again.
 */
export function usePcSongEvents(live: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!live) return
    let socket: WebSocket | null = null
    let reopen: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const open = () => {
      socket = new WebSocket(`${PC_API_ORIGIN.replace(/^http/, 'ws')}/ws`)
      socket.onmessage = (event) => {
        const { type } = JSON.parse(String(event.data)) as { type?: string }
        if (type && SONG_EVENTS.has(type)) {
          void queryClient.invalidateQueries({ queryKey: ['pc-songs'] })
        }
      }
      socket.onclose = () => {
        if (!stopped) reopen = setTimeout(open, REOPEN_MS)
      }
    }
    const ping = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, PING_MS)

    open()
    return () => {
      stopped = true
      clearTimeout(reopen)
      clearInterval(ping)
      socket?.close()
    }
  }, [live, queryClient])
}
