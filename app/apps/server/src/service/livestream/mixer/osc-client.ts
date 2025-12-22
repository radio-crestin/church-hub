import dgram from 'node:dgram'

import { getMixerConfig } from './config'

let oscClient: dgram.Socket | null = null
let currentHost = ''
let currentPort = 0

function formatChannelNumber(channel: number): string {
  return channel.toString().padStart(2, '0')
}

function createOSCMessage(address: string, value: number): Buffer {
  // OSC message format:
  // - Address pattern (null-terminated, padded to 4-byte boundary)
  // - Type tag string (null-terminated, padded to 4-byte boundary)
  // - Arguments

  // Pad address to 4-byte boundary
  const addressBytes = Buffer.from(address + '\0')
  const addressPadding = (4 - (addressBytes.length % 4)) % 4
  const paddedAddress = Buffer.concat([
    addressBytes,
    Buffer.alloc(addressPadding),
  ])

  // Type tag for integer: ",i\0" padded to 4 bytes
  const typeTag = Buffer.from(',i\0\0')

  // Integer value (big-endian 32-bit)
  const valueBuffer = Buffer.alloc(4)
  valueBuffer.writeInt32BE(value, 0)

  return Buffer.concat([paddedAddress, typeTag, valueBuffer])
}

export function initializeMixerClient(host: string, port: number): void {
  if (oscClient) {
    oscClient.close()
  }

  oscClient = dgram.createSocket('udp4')
  currentHost = host
  currentPort = port

  oscClient.on('error', (err) => {
    // biome-ignore lint/suspicious/noConsole: Logging mixer errors
    console.error('[mixer] OSC client error:', err.message)
  })

  // biome-ignore lint/suspicious/noConsole: Startup logging
  console.log(`[mixer] OSC client initialized for ${host}:${port}`)
}

export function disconnectMixer(): void {
  if (oscClient) {
    oscClient.close()
    oscClient = null
    currentHost = ''
    currentPort = 0
    // biome-ignore lint/suspicious/noConsole: Shutdown logging
    console.log('[mixer] OSC client disconnected')
  }
}

function sendOSCMessage(address: string, value: number): void {
  if (!oscClient) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.warn('[mixer] OSC client not initialized')
    return
  }

  const message = createOSCMessage(address, value)

  oscClient.send(message, currentPort, currentHost, (err) => {
    if (err) {
      // biome-ignore lint/suspicious/noConsole: Error logging
      console.error(`[mixer] Failed to send OSC message: ${err.message}`)
    }
  })
}

export function sendMuteCommand(channel: number): void {
  const channelStr = formatChannelNumber(channel)
  const address = `/ch/${channelStr}/mix/on`
  sendOSCMessage(address, 0)
  // biome-ignore lint/suspicious/noConsole: Debug logging
  console.debug(`[mixer] Mute channel ${channelStr}`)
}

export function sendUnmuteCommand(channel: number): void {
  const channelStr = formatChannelNumber(channel)
  const address = `/ch/${channelStr}/mix/on`
  sendOSCMessage(address, 1)
  // biome-ignore lint/suspicious/noConsole: Debug logging
  console.debug(`[mixer] Unmute channel ${channelStr}`)
}

export async function testMixerConnection(): Promise<{
  success: boolean
  error?: string
}> {
  const config = await getMixerConfig()

  return new Promise((resolve) => {
    const testSocket = dgram.createSocket('udp4')
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        testSocket.close()
        resolve({ success: false, error: 'No response from mixer' })
      }
    }, 3000)

    testSocket.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        testSocket.close()
        resolve({ success: false, error: err.message })
      }
    })

    // Bind to receive responses
    testSocket.bind(() => {
      // Send a status request to the mixer
      // X-AIR responds to /xinfo with mixer info
      const message = createOSCMessage('/xinfo', 0)

      testSocket.send(message, config.port, config.host, (err) => {
        if (err) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            testSocket.close()
            resolve({ success: false, error: err.message })
          }
          return
        }
      })

      // Listen for response from mixer
      testSocket.on('message', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          testSocket.close()
          resolve({ success: true })
        }
      })
    })
  })
}

export async function ensureMixerClient(): Promise<void> {
  const config = await getMixerConfig()

  if (!config.isEnabled) {
    if (oscClient) {
      disconnectMixer()
    }
    return
  }

  if (
    !oscClient ||
    currentHost !== config.host ||
    currentPort !== config.port
  ) {
    initializeMixerClient(config.host, config.port)
  }
}
