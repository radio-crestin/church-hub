import { randomUUID } from 'node:crypto'

import { sendToRust } from './rust-ipc'

export const verificationStore = new Map<string, (v: boolean) => void>()

// Timeout for token verification (ms)
const VERIFY_TIMEOUT_MS = 5000

export function verifyAuthToken(authToken: string) {
  return new Promise<boolean>((resolve) => {
    const id = randomUUID()

    // Set up timeout to prevent hanging forever
    const timeoutId = setTimeout(() => {
      verificationStore.delete(id)
      resolve(false)
    }, VERIFY_TIMEOUT_MS)

    verificationStore.set(id, (result: boolean) => {
      clearTimeout(timeoutId)
      resolve(result)
    })

    sendToRust(`[verify-token] ${JSON.stringify({ id, token: authToken })}`)
  })
}
