import { connect, createServer } from 'node:net'

import { getListenHost } from './listenHost'

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, host)
  })
}

function answersOnLoopback(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1', timeout: 1000 })
    const done = (answered: boolean) => {
      socket.destroy()
      resolve(answered)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.once('timeout', () => done(false))
  })
}

/**
 * True when nothing holds the port. A few milliseconds, so a normal start
 * skips the slow `lsof` / `netstat` lookup for a stale server. The probe binds
 * only the server's own listen host, so a loopback-only test server never
 * opens a LAN port (no Windows firewall prompt, T-193); a connect to
 * 127.0.0.1 catches a holder on the other host, since Windows lets 127.0.0.1
 * bind next to a process holding 0.0.0.0, and the other way round.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (
    (await canListen(port, getListenHost())) && !(await answersOnLoopback(port))
  )
}
