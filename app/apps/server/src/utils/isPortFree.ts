import { createServer } from 'node:net'

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, host)
  })
}

/**
 * True when nothing listens on the port, on any interface. A few
 * milliseconds, so a normal start skips the slow `lsof` / `netstat` lookup
 * for a stale server. Both hosts are tried: Windows lets 127.0.0.1 bind next
 * to a process holding 0.0.0.0, and the other way round.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (
    (await canListen(port, '0.0.0.0')) && (await canListen(port, '127.0.0.1'))
  )
}
