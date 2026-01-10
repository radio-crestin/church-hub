import { existsSync } from 'node:fs'

import {
  DEFAULT_MIDI_CONFIG,
  LED_VELOCITY_OFF,
  LED_VELOCITY_ON,
  type MIDIConfig,
  type MIDIDevice,
  type MIDIInputMessage,
} from './types'
import { midiLogger } from '../../utils/fileLogger'
import { getMidiNativeModulePath } from '../../utils/paths'

// Lazy-loaded easymidi module (may not be available in production builds)
let easymidi: typeof import('easymidi') | null = null
let midiAvailable = true
let midiLoadAttempted = false

/**
 * Attempts to load the MIDI native module from the bundled resources path.
 * This is needed because Bun's compiled binaries don't include native modules.
 */
function tryLoadBundledMidi(): typeof import('easymidi') | null {
  const bundledPath = getMidiNativeModulePath()
  if (!bundledPath) return null

  if (!existsSync(bundledPath)) {
    midiLogger.debug(`Bundled MIDI native module not found at ${bundledPath}`)
    return null
  }

  try {
    // Load the native module directly
    const nativeMidi = require(bundledPath)
    midiLogger.info(
      `Loaded MIDI native module from bundled path: ${bundledPath}`,
    )

    // Create a minimal easymidi-compatible wrapper
    return createEasymidiWrapper(nativeMidi)
  } catch (error) {
    midiLogger.warn(
      `Failed to load bundled MIDI module: ${error instanceof Error ? error.message : error}`,
    )
    return null
  }
}

/**
 * Creates an easymidi-compatible wrapper around the raw @julusian/midi native module
 */
function createEasymidiWrapper(nativeMidi: {
  Input: new (
    callback: (deltaTime: number, message: Uint8Array) => void,
  ) => {
    getPortCount: () => number
    getPortName: (port: number) => string
    openPort: (port: number) => void
    closePort: () => void
    destroy: () => void
    isPortOpen: () => boolean
  }
  Output: new () => {
    getPortCount: () => number
    getPortName: (port: number) => string
    openPort: (port: number) => void
    closePort: () => void
    destroy: () => void
    isPortOpen: () => boolean
    sendMessage: (message: Buffer) => void
  }
}): typeof import('easymidi') {
  // Get list of input device names
  function getInputs(): string[] {
    const tempInput = new nativeMidi.Input(() => {})
    const count = tempInput.getPortCount()
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      names.push(tempInput.getPortName(i))
    }
    tempInput.destroy()
    return names
  }

  // Get list of output device names
  function getOutputs(): string[] {
    const tempOutput = new nativeMidi.Output()
    const count = tempOutput.getPortCount()
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      names.push(tempOutput.getPortName(i))
    }
    tempOutput.destroy()
    return names
  }

  class Input {
    private input: ReturnType<typeof nativeMidi.Input.prototype.constructor>
    private listeners: Map<
      string,
      Set<(msg: Record<string, unknown>) => void>
    > = new Map()

    constructor(name: string) {
      this.input = new nativeMidi.Input(
        (deltaTime: number, message: Uint8Array) => {
          const msg = this.parseMessage(Array.from(message))
          if (msg) {
            const eventListeners = this.listeners.get(msg._type as string)
            if (eventListeners) {
              for (const listener of eventListeners) {
                listener(msg)
              }
            }
          }
        },
      )

      // Find and open the port by name
      const count = this.input.getPortCount()
      for (let i = 0; i < count; i++) {
        if (this.input.getPortName(i) === name) {
          this.input.openPort(i)
          break
        }
      }
    }

    private parseMessage(bytes: number[]): Record<string, unknown> | null {
      if (bytes.length < 1) return null

      const status = bytes[0]
      const type = status & 0xf0
      const channel = status & 0x0f

      if (type === 0x90 && bytes[2] > 0) {
        return { _type: 'noteon', channel, note: bytes[1], velocity: bytes[2] }
      }
      if (type === 0x80 || (type === 0x90 && bytes[2] === 0)) {
        return { _type: 'noteoff', channel, note: bytes[1], velocity: bytes[2] }
      }
      if (type === 0xb0) {
        return { _type: 'cc', channel, controller: bytes[1], value: bytes[2] }
      }
      return null
    }

    on(event: string, callback: (msg: Record<string, unknown>) => void): this {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set())
      }
      this.listeners.get(event)?.add(callback)
      return this
    }

    removeAllListeners(): void {
      this.listeners.clear()
    }

    close(): void {
      this.input.closePort()
      this.input.destroy()
    }

    isPortOpen(): boolean {
      return this.input.isPortOpen()
    }
  }

  class Output {
    private output: ReturnType<typeof nativeMidi.Output.prototype.constructor>

    constructor(name: string) {
      this.output = new nativeMidi.Output()

      // Find and open the port by name
      const count = this.output.getPortCount()
      for (let i = 0; i < count; i++) {
        if (this.output.getPortName(i) === name) {
          this.output.openPort(i)
          break
        }
      }
    }

    send(type: string, params: Record<string, number>): void {
      let message: number[] = []

      // Use nullish coalescing (??) instead of || to properly handle 0 values
      // This is critical for LED control where velocity 0 means OFF
      if (type === 'noteon') {
        message = [
          0x90 | (params.channel ?? 0),
          params.note ?? 0,
          params.velocity ?? 127,
        ]
      } else if (type === 'noteoff') {
        message = [
          0x80 | (params.channel ?? 0),
          params.note ?? 0,
          params.velocity ?? 0,
        ]
      } else if (type === 'cc') {
        message = [
          0xb0 | (params.channel ?? 0),
          params.controller ?? 0,
          params.value ?? 0,
        ]
      }

      if (message.length > 0) {
        this.output.sendMessage(Buffer.from(message))
      }
    }

    close(): void {
      this.output.closePort()
      this.output.destroy()
    }

    isPortOpen(): boolean {
      return this.output.isPortOpen()
    }
  }

  return {
    getInputs,
    getOutputs,
    Input: Input as unknown as typeof import('easymidi').Input,
    Output: Output as unknown as typeof import('easymidi').Output,
  } as typeof import('easymidi')
}

function loadMidi(): boolean {
  if (midiLoadAttempted) return midiAvailable
  midiLoadAttempted = true

  // First try to load from bundled resources (production builds)
  easymidi = tryLoadBundledMidi()
  if (easymidi) {
    midiAvailable = true
    return true
  }

  // Fall back to standard require (development)
  try {
    // Dynamic require to avoid crash at import time
    easymidi = require('easymidi')
    midiAvailable = true
    midiLogger.info('MIDI native module loaded successfully')
  } catch (error) {
    midiAvailable = false
    easymidi = null
    midiLogger.warn(
      `MIDI native module not available: ${error instanceof Error ? error.message : error}`,
    )
    midiLogger.warn('MIDI features will be disabled')
  }
  return midiAvailable
}

// Current state
let config: MIDIConfig = { ...DEFAULT_MIDI_CONFIG }
let currentInput: import('easymidi').Input | null = null
let currentOutput: import('easymidi').Output | null = null

// Store device names for reconnection (IDs can change when devices reconnect)
let connectedInputName: string | null = null
let connectedOutputName: string | null = null

// Track requested device IDs for reconnection when we don't have device names
let requestedInputDeviceId: number | null = null
let requestedOutputDeviceId: number | null = null

// Reconnection state
let isReconnecting = false
let reconnectIntervalId: ReturnType<typeof setInterval> | null = null
const RECONNECT_INTERVAL_MS = 3000 // Check every 3 seconds
const DEVICE_CHECK_INTERVAL_MS = 2000 // Check device status every 2 seconds
let deviceCheckIntervalId: ReturnType<typeof setInterval> | null = null

// Callback for MIDI messages to be sent via WebSocket
type MIDIMessageCallback = (message: MIDIInputMessage) => void
let messageCallback: MIDIMessageCallback | null = null

// Callback for connection status changes
type ConnectionStatusCallback = (
  status: ReturnType<typeof getConnectionStatus> & { isReconnecting: boolean },
) => void
let connectionStatusCallback: ConnectionStatusCallback | null = null

// Callback for device list changes (used to notify clients when devices reconnect)
type DevicesChangedCallback = (
  devices: ReturnType<typeof getAllDevices>,
) => void
let devicesChangedCallback: DevicesChangedCallback | null = null

/**
 * Get list of available MIDI input devices
 */
export function getInputDevices(): MIDIDevice[] {
  if (!loadMidi() || !easymidi) return []

  try {
    const inputs = easymidi.getInputs()
    return inputs.map((name, index) => ({
      id: index,
      name,
      type: 'input' as const,
    }))
  } catch (error) {
    midiLogger.error(`Failed to get input devices: ${error}`)
    return []
  }
}

/**
 * Get list of available MIDI output devices
 */
export function getOutputDevices(): MIDIDevice[] {
  if (!loadMidi() || !easymidi) return []

  try {
    const outputs = easymidi.getOutputs()
    return outputs.map((name, index) => ({
      id: index,
      name,
      type: 'output' as const,
    }))
  } catch (error) {
    midiLogger.error(`Failed to get output devices: ${error}`)
    return []
  }
}

/**
 * Get all available MIDI devices
 */
export function getAllDevices(): {
  inputs: MIDIDevice[]
  outputs: MIDIDevice[]
} {
  return {
    inputs: getInputDevices(),
    outputs: getOutputDevices(),
  }
}

/**
 * Handle incoming MIDI note on message
 * Debouncing is handled by the shortcuts handler in shortcuts.ts
 */
function handleNoteOn(msg: {
  note: number
  velocity: number
  channel: number
}) {
  const message: MIDIInputMessage = {
    type: msg.velocity > 0 ? 'note_on' : 'note_off',
    channel: msg.channel,
    note: msg.note,
    value: msg.velocity,
    timestamp: Date.now(),
  }

  midiLogger.info(
    `Note ${msg.velocity > 0 ? 'on' : 'off'}: note=${msg.note} velocity=${msg.velocity} channel=${msg.channel}`,
  )

  if (messageCallback) {
    midiLogger.debug('Calling messageCallback')
    messageCallback(message)
  } else {
    midiLogger.warn('No messageCallback registered!')
  }
}

/**
 * Handle incoming MIDI note off message
 */
function handleNoteOff(msg: {
  note: number
  velocity: number
  channel: number
}) {
  const message: MIDIInputMessage = {
    type: 'note_off',
    channel: msg.channel,
    note: msg.note,
    value: msg.velocity,
    timestamp: Date.now(),
  }

  midiLogger.debug(
    `Note off: note=${msg.note} velocity=${msg.velocity} channel=${msg.channel}`,
  )

  if (messageCallback) {
    messageCallback(message)
  }
}

/**
 * Handle incoming MIDI control change message
 * Debouncing is handled by the shortcuts handler in shortcuts.ts
 */
function handleControlChange(msg: {
  controller: number
  value: number
  channel: number
}) {
  const message: MIDIInputMessage = {
    type: 'control_change',
    channel: msg.channel,
    controller: msg.controller,
    value: msg.value,
    timestamp: Date.now(),
  }

  midiLogger.info(
    `Control change: controller=${msg.controller} value=${msg.value} channel=${msg.channel}`,
  )

  if (messageCallback) {
    messageCallback(message)
  }
}

/**
 * Connect to a MIDI input device by index or name
 * @param deviceId - Device index to connect to
 * @param byName - If provided, connect by device name instead of index (used for reconnection)
 * @param startReconnectOnFail - If true and connection fails, start reconnection process
 */
export function connectInput(
  deviceId: number,
  byName?: string,
  startReconnectOnFail = false,
): boolean {
  if (!loadMidi() || !easymidi) {
    midiLogger.warn('Cannot connect to input: MIDI not available')
    return false
  }

  midiLogger.info(
    `Attempting to connect to input device ${byName || deviceId}...`,
  )

  // Disconnect existing input first (but preserve name if reconnecting)
  const preserveName = connectedInputName
  disconnectInput()
  if (byName) {
    connectedInputName = preserveName
  }

  try {
    const inputs = easymidi.getInputs()
    midiLogger.debug(`Available inputs: ${JSON.stringify(inputs)}`)

    let targetDeviceId = deviceId
    let deviceName: string

    // If reconnecting by name, find the device ID
    if (byName) {
      targetDeviceId = inputs.findIndex((name) => name === byName)
      if (targetDeviceId === -1) {
        midiLogger.debug(`Device "${byName}" not found in available inputs`)
        // Keep the name for reconnection attempts
        connectedInputName = byName
        if (startReconnectOnFail) {
          startReconnecting()
          startDeviceMonitoring()
        }
        return false
      }
      deviceName = byName
    } else {
      if (deviceId < 0 || deviceId >= inputs.length) {
        // Device ID is out of range - device might be disconnected
        midiLogger.warn(
          `Input device ID ${deviceId} not found (only ${inputs.length} devices available)`,
        )
        if (startReconnectOnFail) {
          // Store the requested device ID for reconnection attempts
          requestedInputDeviceId = deviceId
          midiLogger.info(
            `Stored requested input device ID ${deviceId} for reconnection`,
          )
          startReconnecting()
          startDeviceMonitoring()
        }
        return false
      }
      deviceName = inputs[deviceId]
    }

    midiLogger.info(`Connecting to: ${deviceName}`)

    currentInput = new easymidi.Input(deviceName)

    // Listen for MIDI messages
    currentInput.on('noteon', handleNoteOn)
    currentInput.on('noteoff', handleNoteOff)
    currentInput.on('cc', handleControlChange)

    config.inputDeviceId = targetDeviceId
    connectedInputName = deviceName
    requestedInputDeviceId = null // Clear the requested ID since we're now connected
    midiLogger.info(`✓ Connected to MIDI input: ${deviceName}`)
    midiLogger.info(`Listening for MIDI events...`)

    // Start device monitoring if not already running
    startDeviceMonitoring()

    return true
  } catch (error) {
    midiLogger.error(`Failed to connect to input device ${deviceId}: ${error}`)
    currentInput = null
    if (startReconnectOnFail) {
      startReconnecting()
      startDeviceMonitoring()
    }
    return false
  }
}

/**
 * Disconnect from current MIDI input device
 * @param clearName - Whether to clear the stored device name (false when reconnecting)
 */
export function disconnectInput(clearName = true) {
  if (currentInput) {
    // Remove listeners first (may not exist in all implementations)
    try {
      currentInput.removeAllListeners()
    } catch (error) {
      midiLogger.debug(`removeAllListeners not available: ${error}`)
    }

    // Always try to close, regardless of removeAllListeners result
    try {
      currentInput.close()
      midiLogger.info('Disconnected from MIDI input')
    } catch (error) {
      midiLogger.error(`Error closing input: ${error}`)
    }

    currentInput = null
  }
  config.inputDeviceId = null
  if (clearName) {
    connectedInputName = null
    requestedInputDeviceId = null
  }
}

/**
 * Connect to a MIDI output device by index or name
 * @param deviceId - Device index to connect to
 * @param byName - If provided, connect by device name instead of index (used for reconnection)
 * @param startReconnectOnFail - If true and connection fails, start reconnection process
 */
export async function connectOutput(
  deviceId: number,
  byName?: string,
  startReconnectOnFail = false,
): Promise<boolean> {
  if (!loadMidi() || !easymidi) {
    midiLogger.warn('Cannot connect to output: MIDI not available')
    return false
  }

  // Disconnect existing output first (but preserve name if reconnecting)
  const preserveName = connectedOutputName
  disconnectOutput()
  if (byName) {
    connectedOutputName = preserveName
  }

  try {
    const outputs = easymidi.getOutputs()

    let targetDeviceId = deviceId
    let deviceName: string

    // If reconnecting by name, find the device ID
    if (byName) {
      targetDeviceId = outputs.findIndex((name) => name === byName)
      if (targetDeviceId === -1) {
        midiLogger.debug(`Device "${byName}" not found in available outputs`)
        // Keep the name for reconnection attempts
        connectedOutputName = byName
        if (startReconnectOnFail) {
          startReconnecting()
          startDeviceMonitoring()
        }
        return false
      }
      deviceName = byName
    } else {
      if (deviceId < 0 || deviceId >= outputs.length) {
        midiLogger.warn(
          `Output device ID ${deviceId} not found (only ${outputs.length} devices available)`,
        )
        if (startReconnectOnFail) {
          // Store the requested device ID for reconnection attempts
          requestedOutputDeviceId = deviceId
          midiLogger.info(
            `Stored requested output device ID ${deviceId} for reconnection`,
          )
          startReconnecting()
          startDeviceMonitoring()
        }
        return false
      }
      deviceName = outputs[deviceId]
    }

    currentOutput = new easymidi.Output(deviceName)

    config.outputDeviceId = targetDeviceId
    connectedOutputName = deviceName
    requestedOutputDeviceId = null // Clear the requested ID since we're now connected
    midiLogger.info(`Connected to MIDI output: ${deviceName}`)

    // Reset all LEDs to off state on connection
    // Windows doesn't reset MIDI port state when opening, unlike macOS
    // This ensures a clean LED state regardless of platform
    // Await to prevent race conditions with client LED refresh
    await resetAllLEDs()

    // Start device monitoring if not already running
    startDeviceMonitoring()

    return true
  } catch (error) {
    midiLogger.error(`Failed to connect to output device ${deviceId}: ${error}`)
    currentOutput = null
    if (startReconnectOnFail) {
      startReconnecting()
      startDeviceMonitoring()
    }
    return false
  }
}

/**
 * Disconnect from current MIDI output device
 * @param clearName - Whether to clear the stored device name (false when reconnecting)
 */
export function disconnectOutput(clearName = true) {
  if (currentOutput) {
    try {
      currentOutput.close()
      midiLogger.info('Disconnected from MIDI output')
    } catch (error) {
      midiLogger.error(`Error disconnecting output: ${error}`)
    }
    currentOutput = null
  }
  config.outputDeviceId = null
  if (clearName) {
    connectedOutputName = null
    requestedOutputDeviceId = null
  }
}

/**
 * Set LED state for a specific note
 */
export function setLED(note: number, on: boolean) {
  if (!currentOutput) {
    midiLogger.debug('Cannot set LED: no output device connected')
    return
  }

  try {
    currentOutput.send('noteon', {
      note,
      velocity: on ? LED_VELOCITY_ON : LED_VELOCITY_OFF,
      channel: 0,
    })
    midiLogger.debug(`LED ${note} set to ${on ? 'ON' : 'OFF'}`)
  } catch (error) {
    midiLogger.error(`Error setting LED ${note}: ${error}`)
  }
}

/**
 * Set multiple LED states at once
 */
export function setAllLEDs(ledStates: Array<{ note: number; on: boolean }>) {
  for (const { note, on } of ledStates) {
    setLED(note, on)
  }
}

/**
 * Turn off all LEDs (for cleanup)
 */
export function turnOffAllLEDs(notes: number[]) {
  for (const note of notes) {
    setLED(note, false)
  }
}

/**
 * Delay helper for async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Reset all LEDs to off state
 * Used on device connection to ensure clean initial state across all platforms
 * Windows doesn't reset MIDI port state on open unlike macOS CoreMIDI
 *
 * IMPORTANT: Messages are sent with small delays to prevent overwhelming
 * the MIDI controller's receive buffer. In release mode, the optimized code
 * executes too fast and can cause buffer overflow, leaving LEDs in undefined states.
 */
async function resetAllLEDs() {
  if (!currentOutput) return

  midiLogger.debug('Resetting all LEDs to off state')

  // Capture output reference to ensure it's still valid throughout the async operation
  const output = currentOutput

  // Reset notes 0-63 which covers most MIDI controllers (pads, buttons)
  // APC Mini uses 0-63 for buttons, Launchpad uses similar ranges
  // Send in batches with delays to prevent buffer overflow
  const BATCH_SIZE = 8
  const BATCH_DELAY_MS = 5 // 5ms delay between batches

  for (let batch = 0; batch < 64 / BATCH_SIZE; batch++) {
    const startNote = batch * BATCH_SIZE
    const endNote = Math.min(startNote + BATCH_SIZE, 64)

    for (let note = startNote; note < endNote; note++) {
      try {
        output.send('noteon', {
          note,
          velocity: LED_VELOCITY_OFF,
          channel: 0,
        })
      } catch {
        // Ignore individual note errors, continue with reset
      }
    }

    // Add delay between batches (except after the last batch)
    if (batch < 64 / BATCH_SIZE - 1) {
      await delay(BATCH_DELAY_MS)
    }
  }

  midiLogger.debug('All LEDs reset complete')
}

/**
 * Set callback for MIDI messages
 */
export function setMessageCallback(callback: MIDIMessageCallback | null) {
  messageCallback = callback
}

/**
 * Set callback for connection status changes
 */
export function setConnectionStatusCallback(
  callback: ConnectionStatusCallback | null,
) {
  connectionStatusCallback = callback
}

/**
 * Set callback for device list changes
 */
export function setDevicesChangedCallback(
  callback: DevicesChangedCallback | null,
) {
  devicesChangedCallback = callback
}

/**
 * Broadcast connection status to clients
 */
function broadcastConnectionStatus() {
  if (connectionStatusCallback) {
    const status = getConnectionStatus()
    midiLogger.debug(
      `Broadcasting connection status: isReconnecting=${isReconnecting}, ` +
        `inputConnected=${status.inputConnected}, outputConnected=${status.outputConnected}`,
    )
    connectionStatusCallback({ ...status, isReconnecting })
  } else {
    midiLogger.debug(
      'No connection status callback registered, skipping broadcast',
    )
  }
}

/**
 * Broadcast device list to clients
 */
function broadcastDevices() {
  if (devicesChangedCallback) {
    const devices = getAllDevices()
    devicesChangedCallback(devices)
  }
}

/**
 * Check if devices are still available and handle disconnection
 */
function checkDeviceStatus() {
  if (!loadMidi() || !easymidi) return

  const inputs = easymidi.getInputs()
  const outputs = easymidi.getOutputs()

  let needsReconnect = false

  // Check if input device is still available
  if (connectedInputName && currentInput) {
    const inputStillExists = inputs.includes(connectedInputName)
    if (!inputStillExists) {
      midiLogger.warn(`MIDI input device "${connectedInputName}" disconnected`)
      disconnectInput(false) // Keep the name for reconnection
      needsReconnect = true
    }
  }

  // Check if output device is still available
  if (connectedOutputName && currentOutput) {
    const outputStillExists = outputs.includes(connectedOutputName)
    if (!outputStillExists) {
      midiLogger.warn(
        `MIDI output device "${connectedOutputName}" disconnected`,
      )
      disconnectOutput(false) // Keep the name for reconnection
      needsReconnect = true
    }
  }

  if (needsReconnect && !isReconnecting) {
    startReconnecting()
  }
}

/**
 * Start the reconnection process
 */
function startReconnecting() {
  if (isReconnecting) return

  isReconnecting = true
  midiLogger.info('Starting MIDI device reconnection process...')
  broadcastConnectionStatus()

  // Clear existing reconnect interval if any
  if (reconnectIntervalId) {
    clearInterval(reconnectIntervalId)
  }

  reconnectIntervalId = setInterval(() => {
    attemptReconnection()
  }, RECONNECT_INTERVAL_MS)

  // Try immediately
  attemptReconnection()
}

/**
 * Attempt to reconnect to previously connected devices
 */
async function attemptReconnection() {
  if (!loadMidi() || !easymidi) return

  midiLogger.debug('Attempting to reconnect MIDI devices...')

  const inputs = easymidi.getInputs()
  const outputs = easymidi.getOutputs()

  // Determine what we need to reconnect
  const needInputReconnect =
    currentInput === null &&
    (connectedInputName !== null || requestedInputDeviceId !== null)
  const needOutputReconnect =
    currentOutput === null &&
    (connectedOutputName !== null || requestedOutputDeviceId !== null)

  let inputReconnected = !needInputReconnect
  let outputReconnected = !needOutputReconnect

  // Try to reconnect input device
  if (needInputReconnect) {
    // First try by name if we have one
    if (connectedInputName && inputs.includes(connectedInputName)) {
      midiLogger.info(
        `Found input device "${connectedInputName}", reconnecting...`,
      )
      if (connectInput(0, connectedInputName)) {
        inputReconnected = true
        midiLogger.info(`✓ Reconnected to input device: ${connectedInputName}`)
      }
    }
    // Otherwise try by requested device ID if devices are now available
    else if (
      requestedInputDeviceId !== null &&
      inputs.length > 0 &&
      requestedInputDeviceId < inputs.length
    ) {
      midiLogger.info(
        `Input devices available, reconnecting to device ID ${requestedInputDeviceId}...`,
      )
      if (connectInput(requestedInputDeviceId)) {
        inputReconnected = true
        midiLogger.info(
          `✓ Reconnected to input device ID: ${requestedInputDeviceId}`,
        )
      }
    }
    // If we have a requested ID but it's out of range, try connecting to first available device
    else if (requestedInputDeviceId !== null && inputs.length > 0) {
      midiLogger.info(
        `Requested input device ID ${requestedInputDeviceId} out of range, connecting to first available device...`,
      )
      if (connectInput(0)) {
        inputReconnected = true
        midiLogger.info(`✓ Connected to first available input device`)
      }
    }
  }

  // Try to reconnect output device
  if (needOutputReconnect) {
    // First try by name if we have one
    if (connectedOutputName && outputs.includes(connectedOutputName)) {
      midiLogger.info(
        `Found output device "${connectedOutputName}", reconnecting...`,
      )
      if (await connectOutput(0, connectedOutputName)) {
        outputReconnected = true
        midiLogger.info(
          `✓ Reconnected to output device: ${connectedOutputName}`,
        )
      }
    }
    // Otherwise try by requested device ID if devices are now available
    else if (
      requestedOutputDeviceId !== null &&
      outputs.length > 0 &&
      requestedOutputDeviceId < outputs.length
    ) {
      midiLogger.info(
        `Output devices available, reconnecting to device ID ${requestedOutputDeviceId}...`,
      )
      if (await connectOutput(requestedOutputDeviceId)) {
        outputReconnected = true
        midiLogger.info(
          `✓ Reconnected to output device ID: ${requestedOutputDeviceId}`,
        )
      }
    }
    // If we have a requested ID but it's out of range, try connecting to first available device
    else if (requestedOutputDeviceId !== null && outputs.length > 0) {
      midiLogger.info(
        `Requested output device ID ${requestedOutputDeviceId} out of range, connecting to first available device...`,
      )
      if (await connectOutput(0)) {
        outputReconnected = true
        midiLogger.info(`✓ Connected to first available output device`)
      }
    }
  }

  // If all devices reconnected, stop the reconnection process
  if (inputReconnected && outputReconnected) {
    stopReconnecting()
  }
}

/**
 * Stop the reconnection process
 */
function stopReconnecting() {
  if (!isReconnecting) return

  isReconnecting = false
  midiLogger.info(
    'MIDI device reconnection complete, notifying clients to refresh LED states',
  )

  if (reconnectIntervalId) {
    clearInterval(reconnectIntervalId)
    reconnectIntervalId = null
  }

  // Broadcast updated device list and connection status to all clients
  // Device IDs may have changed after reconnection
  // This triggers client-side LED refresh via the isReconnecting transition
  midiLogger.debug(
    'Broadcasting devices and connection status after reconnection',
  )
  broadcastDevices()
  broadcastConnectionStatus()
}

/**
 * Start device monitoring (checks if devices are still connected)
 */
function startDeviceMonitoring() {
  if (deviceCheckIntervalId) return // Already monitoring

  midiLogger.debug('Starting MIDI device monitoring')
  deviceCheckIntervalId = setInterval(() => {
    checkDeviceStatus()
  }, DEVICE_CHECK_INTERVAL_MS)
}

/**
 * Stop device monitoring
 */
function stopDeviceMonitoring() {
  if (deviceCheckIntervalId) {
    clearInterval(deviceCheckIntervalId)
    deviceCheckIntervalId = null
    midiLogger.debug('Stopped MIDI device monitoring')
  }

  if (reconnectIntervalId) {
    clearInterval(reconnectIntervalId)
    reconnectIntervalId = null
  }

  isReconnecting = false
}

/**
 * Check if MIDI native module is available
 */
export function isMidiAvailable(): boolean {
  return loadMidi()
}

/**
 * Get current MIDI connection status
 */
export function getConnectionStatus() {
  const inputs = getInputDevices()
  const outputs = getOutputDevices()

  return {
    available: midiAvailable,
    enabled: config.enabled,
    inputConnected: currentInput !== null,
    outputConnected: currentOutput !== null,
    inputDevice:
      config.inputDeviceId !== null
        ? inputs[config.inputDeviceId]?.name || null
        : connectedInputName, // Use stored name when reconnecting
    outputDevice:
      config.outputDeviceId !== null
        ? outputs[config.outputDeviceId]?.name || null
        : connectedOutputName, // Use stored name when reconnecting
    inputDeviceId: config.inputDeviceId,
    outputDeviceId: config.outputDeviceId,
    isReconnecting,
    reconnectingInputDevice:
      isReconnecting && connectedInputName && currentInput === null
        ? connectedInputName
        : null,
    reconnectingOutputDevice:
      isReconnecting && connectedOutputName && currentOutput === null
        ? connectedOutputName
        : null,
  }
}

/**
 * Get current MIDI configuration
 */
export function getConfig(): MIDIConfig {
  return { ...config }
}

/**
 * Update MIDI configuration
 */
export function updateConfig(updates: Partial<MIDIConfig>) {
  config = { ...config, ...updates }
}

/**
 * Set enabled state
 */
export function setEnabled(enabled: boolean) {
  config.enabled = enabled

  if (!enabled) {
    stopDeviceMonitoring()
    disconnectInput()
    disconnectOutput()
  }
}

/**
 * Initialize MIDI service (called on server startup)
 */
export function initializeMIDI() {
  midiLogger.info('Initializing MIDI service...')

  // Try to load the MIDI module
  if (!loadMidi()) {
    midiLogger.warn('MIDI service disabled - native module not available')
    return
  }

  const devices = getAllDevices()
  midiLogger.info(
    `Found ${devices.inputs.length} input(s), ${devices.outputs.length} output(s)`,
  )

  for (const device of devices.inputs) {
    midiLogger.info(`  Input ${device.id}: ${device.name}`)
  }
  for (const device of devices.outputs) {
    midiLogger.info(`  Output ${device.id}: ${device.name}`)
  }

  midiLogger.info('Service initialized. Waiting for device connection...')
}

/**
 * Shutdown MIDI service (called on server shutdown)
 */
export function shutdownMIDI() {
  midiLogger.info('Shutting down MIDI service')
  stopDeviceMonitoring()
  disconnectInput()
  disconnectOutput()
}

// Export types
export type { MIDIConfig, MIDIDevice, MIDIInputMessage }

export { DEFAULT_MIDI_CONFIG } from './types'
