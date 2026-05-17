import {
  connectInput,
  connectOutput,
  disconnectInput,
  disconnectOutput,
  getAllDevices,
  getConnectionStatus,
  setEnabled,
} from '../service/midi'
import {
  dumpShortcutMap,
  getMIDIShortcutCount,
} from '../service/midi/shortcuts'
import { getSetting } from '../service/settings'
import { midiLogger } from '../utils/fileLogger'
import { broadcastMIDIConnectionStatus } from '../websocket'

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
      midiLogger.debug(
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
      midiLogger.error(`Failed to get MIDI devices: ${error}`)
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
      midiLogger.error(`Failed to get MIDI status: ${error}`)
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Failed to get MIDI status' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // GET /api/midi/debug-shortcuts - Debug MIDI shortcuts map
  if (req.method === 'GET' && url.pathname === '/api/midi/debug-shortcuts') {
    try {
      const shortcutCount = getMIDIShortcutCount()
      const shortcutMap = dumpShortcutMap()
      const setting = getSetting('app_settings', 'global_keyboard_shortcuts')

      return handleCors(
        req,
        new Response(
          JSON.stringify({
            data: {
              shortcutCount,
              shortcutMap,
              rawSetting: setting?.value ? JSON.parse(setting.value) : null,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    } catch (error) {
      midiLogger.error(`Failed to get MIDI shortcuts debug info: ${error}`)
      return handleCors(
        req,
        new Response(
          JSON.stringify({ error: 'Failed to get MIDI shortcuts debug info' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    }
  }

  // POST /api/midi/connect - Connect to MIDI devices
  if (req.method === 'POST' && url.pathname === '/api/midi/connect') {
    try {
      const body = (await req.json()) as {
        inputDeviceName?: string | null
        outputDeviceName?: string | null
      }

      midiLogger.info('Connect request received', body)

      let inputConnected = false
      let outputConnected = false

      if (body.inputDeviceName !== undefined) {
        if (body.inputDeviceName === null) {
          midiLogger.info('Disconnecting input device')
          disconnectInput()
        } else {
          midiLogger.info(
            `Connecting to input device "${body.inputDeviceName}"`,
          )
          inputConnected = connectInput(body.inputDeviceName, true)
          midiLogger.info(`Input connection result: ${inputConnected}`)
        }
      }

      if (body.outputDeviceName !== undefined) {
        if (body.outputDeviceName === null) {
          midiLogger.info('Disconnecting output device')
          disconnectOutput()
        } else {
          midiLogger.info(
            `Connecting to output device "${body.outputDeviceName}"`,
          )
          outputConnected = await connectOutput(body.outputDeviceName, true)
          midiLogger.info(`Output connection result: ${outputConnected}`)
        }
      }

      setEnabled(true)

      const status = getConnectionStatus()
      midiLogger.info('Final connection status', status)

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
      midiLogger.error(`Failed to connect MIDI devices: ${error}`)
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
      midiLogger.error(`Failed to disconnect MIDI devices: ${error}`)
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
