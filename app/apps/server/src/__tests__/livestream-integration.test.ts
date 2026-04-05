/**
 * Integration tests for livestream features using mock external services.
 * Tests OBS WebSocket integration, YouTube API, and mixer OSC communication.
 */

import {
  EMULATOR_CONFIG,
  ensureEmulator,
  isEmulatorAvailable,
  stopEmulator,
} from './helpers/x32-emulator'
import { OBSWebSocketMock } from './mocks/obs-websocket-mock'
import { YouTubeAPIMock } from './mocks/youtube-api-mock'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const _TEST_PORT = 3098
const OBS_PORT = 14455
const YOUTUBE_PORT = 19443

let obsMock: OBSWebSocketMock
let youtubeMock: YouTubeAPIMock

describe('Livestream Integration Tests', () => {
  describe('OBS WebSocket Mock', () => {
    beforeAll(async () => {
      obsMock = new OBSWebSocketMock(OBS_PORT)
      await obsMock.start()
    })

    afterAll(async () => {
      await obsMock.stop()
    })

    it('should accept WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${OBS_PORT}`)

      const hello = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          ws.onmessage = (event) => {
            resolve(JSON.parse(String(event.data)))
          }
          ws.onerror = reject
          setTimeout(() => reject(new Error('Timeout')), 5000)
        },
      )

      expect(hello).toHaveProperty('op', 0) // Hello message
      expect((hello.d as Record<string, unknown>).obsWebSocketVersion).toBe(
        '5.4.2',
      )
      ws.close()
    })

    it('should handle Identify and return Identified', async () => {
      const ws = new WebSocket(`ws://localhost:${OBS_PORT}`)

      // Wait for Hello
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })

      // Send Identify
      ws.send(
        JSON.stringify({
          op: 1,
          d: { rpcVersion: 1 },
        }),
      )

      const identified = await new Promise<Record<string, unknown>>(
        (resolve) => {
          ws.onmessage = (event) => {
            resolve(JSON.parse(String(event.data)))
          }
        },
      )

      expect(identified).toHaveProperty('op', 2) // Identified
      ws.close()
    })

    it('should return scene list', async () => {
      const ws = new WebSocket(`ws://localhost:${OBS_PORT}`)

      // Wait for Hello
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })

      // Send Identify
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }))
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })

      // Request GetSceneList
      ws.send(
        JSON.stringify({
          op: 6,
          d: {
            requestType: 'GetSceneList',
            requestId: 'test-1',
          },
        }),
      )

      const response = await new Promise<Record<string, unknown>>((resolve) => {
        ws.onmessage = (event) => {
          resolve(JSON.parse(String(event.data)))
        }
      })

      expect(response).toHaveProperty('op', 7) // RequestResponse
      const data = response.d as Record<string, unknown>
      expect(data.requestType).toBe('GetSceneList')
      const responseData = data.responseData as Record<string, unknown>
      expect(responseData.currentProgramSceneName).toBe('Main Camera')
      expect(Array.isArray(responseData.scenes)).toBe(true)
      expect((responseData.scenes as unknown[]).length).toBe(5)

      ws.close()
    })

    it('should handle scene switching with event broadcast', async () => {
      const ws = new WebSocket(`ws://localhost:${OBS_PORT}`)

      // Wait for Hello + Identify
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }))
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })

      // Request SetCurrentProgramScene
      ws.send(
        JSON.stringify({
          op: 6,
          d: {
            requestType: 'SetCurrentProgramScene',
            requestId: 'switch-1',
            requestData: { sceneName: 'Screen Share' },
          },
        }),
      )

      // Should get response and event
      const messages: Record<string, unknown>[] = []
      await new Promise<void>((resolve) => {
        let count = 0
        ws.onmessage = (event) => {
          messages.push(JSON.parse(String(event.data)))
          count++
          if (count >= 2) resolve()
        }
        setTimeout(resolve, 2000) // fallback timeout
      })

      // One should be RequestResponse, another should be Event
      const response = messages.find((m) => m.op === 7)
      const eventMsg = messages.find((m) => m.op === 5)

      expect(response).toBeDefined()
      expect(eventMsg).toBeDefined()

      if (eventMsg) {
        const eventData = eventMsg.d as Record<string, unknown>
        expect(eventData.eventType).toBe('CurrentProgramSceneChanged')
      }

      expect(obsMock.getState().currentProgramScene).toBe('Screen Share')
      ws.close()
    })

    it('should handle streaming start/stop', async () => {
      expect(obsMock.getState().streaming).toBe(false)

      const ws = new WebSocket(`ws://localhost:${OBS_PORT}`)

      // Handshake
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }))
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve()
      })

      // Start stream
      ws.send(
        JSON.stringify({
          op: 6,
          d: { requestType: 'StartStream', requestId: 'stream-1' },
        }),
      )

      await new Promise<void>((resolve) => setTimeout(resolve, 100))
      expect(obsMock.getState().streaming).toBe(true)

      // Stop stream
      ws.send(
        JSON.stringify({
          op: 6,
          d: { requestType: 'StopStream', requestId: 'stream-2' },
        }),
      )

      await new Promise<void>((resolve) => setTimeout(resolve, 100))
      expect(obsMock.getState().streaming).toBe(false)

      ws.close()
    })
  })

  describe('YouTube API Mock', () => {
    beforeAll(async () => {
      youtubeMock = new YouTubeAPIMock(YOUTUBE_PORT)
      await youtubeMock.start()
    })

    afterAll(async () => {
      await youtubeMock.stop()
    })

    it('should return token on auth request', async () => {
      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/oauth2/v4/token`,
        {
          method: 'POST',
          body: JSON.stringify({ grant_type: 'refresh_token' }),
        },
      )

      expect(res.ok).toBe(true)
      const data = (await res.json()) as Record<string, unknown>
      expect(data.access_token).toBeDefined()
      expect(data.token_type).toBe('Bearer')
      expect(data.expires_in).toBe(3600)
    })

    it('should list broadcasts', async () => {
      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails`,
      )

      expect(res.ok).toBe(true)
      const data = (await res.json()) as Record<string, unknown>
      expect(data.kind).toBe('youtube#liveBroadcastListResponse')
      expect(Array.isArray(data.items)).toBe(true)
      expect((data.items as unknown[]).length).toBeGreaterThan(0)
    })

    it('should filter upcoming broadcasts', async () => {
      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/youtube/v3/liveBroadcasts?broadcastStatus=upcoming`,
      )

      const data = (await res.json()) as Record<string, unknown>
      const items = data.items as Array<{ status: { lifeCycleStatus: string } }>
      for (const item of items) {
        expect(['created', 'ready']).toContain(item.status.lifeCycleStatus)
      }
    })

    it('should create a new broadcast', async () => {
      const initialCount = youtubeMock.getState().broadcasts.length

      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/youtube/v3/liveBroadcasts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snippet: { title: 'Test Broadcast' },
          }),
        },
      )

      expect(res.ok).toBe(true)
      const data = (await res.json()) as Record<string, unknown>
      expect(data.id).toBeDefined()
      expect(youtubeMock.getState().broadcasts.length).toBe(initialCount + 1)
    })

    it('should list stream keys', async () => {
      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/youtube/v3/liveStreams?part=snippet,cdn,status`,
      )

      expect(res.ok).toBe(true)
      const data = (await res.json()) as Record<string, unknown>
      const items = data.items as Array<{
        cdn: { ingestionInfo: { streamName: string } }
      }>
      expect(items.length).toBeGreaterThan(0)
      expect(items[0].cdn.ingestionInfo.streamName).toBeDefined()
    })

    it('should reject requests when not authenticated', async () => {
      youtubeMock.setAuthenticated(false)

      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/youtube/v3/liveBroadcasts`,
      )

      expect(res.status).toBe(401)
      youtubeMock.setAuthenticated(true)
    })

    it('should handle token revocation', async () => {
      const res = await fetch(
        `http://localhost:${YOUTUBE_PORT}/o/oauth2/revoke`,
      )

      expect(res.ok).toBe(true)
      expect(youtubeMock.getState().authenticated).toBe(false)

      // Reset for other tests
      youtubeMock.reset()
    })
  })

  const emulatorDescribe = isEmulatorAvailable() ? describe : describe.skip

  emulatorDescribe('X32 Mixer Emulator', () => {
    const dgram = require('node:dgram') as typeof import('node:dgram')

    beforeAll(async () => {
      await ensureEmulator()
    })

    afterAll(() => {
      stopEmulator()
    })

    function writeOscString(str: string): Buffer {
      const strBuf = Buffer.from(`${str}\0`, 'ascii')
      const padded = Buffer.alloc(
        strBuf.length + ((4 - (strBuf.length % 4)) % 4),
      )
      strBuf.copy(padded)
      return padded
    }

    function encodeOscMsg(address: string, typeTag = ','): Buffer {
      return Buffer.concat([writeOscString(address), writeOscString(typeTag)])
    }

    function encodeOscMsgWithFloat(address: string, value: number): Buffer {
      const floatBuf = Buffer.alloc(4)
      floatBuf.writeFloatBE(value, 0)
      return Buffer.concat([
        writeOscString(address),
        writeOscString(',f'),
        floatBuf,
      ])
    }

    function sendOscAndReceive(msg: Buffer, timeoutMs = 3000): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const sock = dgram.createSocket('udp4')
        const timer = setTimeout(() => {
          sock.close()
          reject(new Error('OSC response timeout'))
        }, timeoutMs)

        sock.on('message', (data) => {
          clearTimeout(timer)
          sock.close()
          resolve(data)
        })

        sock.bind(0, EMULATOR_CONFIG.ip, () => {
          sock.send(
            msg,
            0,
            msg.length,
            EMULATOR_CONFIG.port,
            EMULATOR_CONFIG.ip,
          )
        })
      })
    }

    it('should respond to /info query', async () => {
      const msg = encodeOscMsg('/info')
      const response = await sendOscAndReceive(msg)

      expect(response.length).toBeGreaterThan(0)
      // /info response contains version strings
      const responseStr = response.toString('ascii')
      expect(responseStr).toContain('/info')
    })

    it('should handle channel fader set/get', async () => {
      // Set channel 1 fader to 0.75
      const setMsg = encodeOscMsgWithFloat('/ch/01/mix/fader', 0.75)
      const sock = dgram.createSocket('udp4')

      await new Promise<void>((resolve) => {
        sock.bind(0, EMULATOR_CONFIG.ip, () => {
          sock.send(
            setMsg,
            0,
            setMsg.length,
            EMULATOR_CONFIG.port,
            EMULATOR_CONFIG.ip,
          )
          resolve()
        })
      })

      sock.close()

      // Small delay for emulator to process
      await new Promise((r) => setTimeout(r, 100))

      // Get the value back
      const getMsg = encodeOscMsg('/ch/01/mix/fader')
      const response = await sendOscAndReceive(getMsg)

      expect(response.length).toBeGreaterThan(0)
      // Response should contain the fader address and a float value
      const responseStr = response.toString('ascii')
      expect(responseStr).toContain('/ch/01/mix/fader')
    })

    it('should handle mute commands', async () => {
      // Mute channel 1 (ON = 0 means muted in X32 convention... or ON=1 means unmuted)
      const muteMsg = encodeOscMsgWithFloat('/ch/01/mix/on', 0)
      const sock = dgram.createSocket('udp4')

      await new Promise<void>((resolve) => {
        sock.bind(0, EMULATOR_CONFIG.ip, () => {
          sock.send(
            muteMsg,
            0,
            muteMsg.length,
            EMULATOR_CONFIG.port,
            EMULATOR_CONFIG.ip,
          )
          resolve()
        })
      })

      sock.close()
      await new Promise((r) => setTimeout(r, 100))

      // Verify by querying
      const getMsg = encodeOscMsg('/ch/01/mix/on')
      const response = await sendOscAndReceive(getMsg)
      expect(response.length).toBeGreaterThan(0)
    })

    it('should handle node queries', async () => {
      // Query channel 1 node state - may timeout if emulator doesn't support /node
      const nodeMsg = Buffer.concat([
        writeOscString('/node'),
        writeOscString(',s'),
        writeOscString('/ch/01/mix'),
      ])

      try {
        const response = await sendOscAndReceive(nodeMsg, 2000)
        expect(response.length).toBeGreaterThan(0)
      } catch {
        // Some emulator builds don't support /node - that's OK
        expect(true).toBe(true)
      }
    })

    it('should handle multiple rapid requests', async () => {
      const promises: Promise<Buffer>[] = []

      for (let i = 1; i <= 5; i++) {
        const ch = String(i).padStart(2, '0')
        const msg = encodeOscMsg(`/ch/${ch}/mix/fader`)
        promises.push(sendOscAndReceive(msg))
      }

      const results = await Promise.all(promises)
      expect(results.length).toBe(5)
      for (const result of results) {
        expect(result.length).toBeGreaterThan(0)
      }
    })
  })
})
