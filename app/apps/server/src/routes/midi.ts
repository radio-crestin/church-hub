import {
  connectInput,
  connectOutput,
  disconnectInput,
  disconnectOutput,
  getAllDevices,
  getConnectionStatus,
  setEnabled,
} from '../service/midi'
import { broadcastMIDIConnectionStatus } from '../websocket'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [midi-routes] ${message}`)
}

type HandleCors = (req: Request, res: Response) => Response

export async function handleMIDIRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Promise<Response | null> {
  // GET /api/midi/devices - List available MIDI devices
  if (req.method === 'GET' && url.pathname === '/api/midi/devices') {
    try {
      const devices = getAllDevices()
      log(
        'debug',
        `Found ${devices.inputs.length} inputs, ${devices.outputs.length} outputs`,
      )

      return handleCors(
        req,
        new Response(JSON.stringify({ data: devices }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      log('error', `Failed to get MIDI devices: ${error}`)
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Failed to get MIDI devices' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // GET /api/midi/status - Get MIDI connection status
  if (req.method === 'GET' && url.pathname === '/api/midi/status') {
    try {
      const status = getConnectionStatus()

      return handleCors(
        req,
        new Response(JSON.stringify({ data: status }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      log('error', `Failed to get MIDI status: ${error}`)
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Failed to get MIDI status' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // POST /api/midi/connect - Connect to MIDI devices
  if (req.method === 'POST' && url.pathname === '/api/midi/connect') {
    try {
      const body = (await req.json()) as {
        inputDeviceId?: number | null
        outputDeviceId?: number | null
      }

      let inputConnected = false
      let outputConnected = false

      if (body.inputDeviceId !== undefined) {
        if (body.inputDeviceId === null) {
          disconnectInput()
        } else {
          inputConnected = connectInput(body.inputDeviceId)
        }
      }

      if (body.outputDeviceId !== undefined) {
        if (body.outputDeviceId === null) {
          disconnectOutput()
        } else {
          outputConnected = connectOutput(body.outputDeviceId)
        }
      }

      setEnabled(true)

      const status = getConnectionStatus()

      // Broadcast status to all clients
      broadcastMIDIConnectionStatus(status)

      return handleCors(
        req,
        new Response(
          JSON.stringify({
            data: {
              ...status,
              inputConnected,
              outputConnected,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    } catch (error) {
      log('error', `Failed to connect MIDI devices: ${error}`)
      return handleCors(
        req,
        new Response(
          JSON.stringify({ error: 'Failed to connect MIDI devices' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // POST /api/midi/disconnect - Disconnect from MIDI devices
  if (req.method === 'POST' && url.pathname === '/api/midi/disconnect') {
    try {
      disconnectInput()
      disconnectOutput()
      setEnabled(false)

      const status = getConnectionStatus()

      // Broadcast status to all clients
      broadcastMIDIConnectionStatus(status)

      return handleCors(
        req,
        new Response(JSON.stringify({ data: status }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      log('error', `Failed to disconnect MIDI devices: ${error}`)
      return handleCors(
        req,
        new Response(
          JSON.stringify({ error: 'Failed to disconnect MIDI devices' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // Not a MIDI route
  return null
}
