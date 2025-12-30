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

      if (type === 'noteon') {
        message = [
          0x90 | (params.channel || 0),
          params.note || 0,
          params.velocity || 127,
        ]
      } else if (type === 'noteoff') {
        message = [
          0x80 | (params.channel || 0),
          params.note || 0,
          params.velocity || 0,
        ]
      } else if (type === 'cc') {
        message = [
          0xb0 | (params.channel || 0),
          params.controller || 0,
          params.value || 0,
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

// Callback for MIDI messages to be sent via WebSocket
type MIDIMessageCallback = (message: MIDIInputMessage) => void
let messageCallback: MIDIMessageCallback | null = null

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
 * Connect to a MIDI input device by index
 */
export function connectInput(deviceId: number): boolean {
  if (!loadMidi() || !easymidi) {
    midiLogger.warn('Cannot connect to input: MIDI not available')
    return false
  }

  midiLogger.info(`Attempting to connect to input device ${deviceId}...`)

  // Disconnect existing input first
  disconnectInput()

  try {
    const inputs = easymidi.getInputs()
    midiLogger.debug(`Available inputs: ${JSON.stringify(inputs)}`)

    if (deviceId < 0 || deviceId >= inputs.length) {
      midiLogger.error(`Invalid input device ID: ${deviceId}`)
      return false
    }

    const deviceName = inputs[deviceId]
    midiLogger.info(`Connecting to: ${deviceName}`)

    currentInput = new easymidi.Input(deviceName)

    // Listen for MIDI messages
    currentInput.on('noteon', handleNoteOn)
    currentInput.on('noteoff', handleNoteOff)
    currentInput.on('cc', handleControlChange)

    config.inputDeviceId = deviceId
    midiLogger.info(`✓ Connected to MIDI input: ${deviceName}`)
    midiLogger.info(`Listening for MIDI events...`)
    return true
  } catch (error) {
    midiLogger.error(`Failed to connect to input device ${deviceId}: ${error}`)
    currentInput = null
    return false
  }
}

/**
 * Disconnect from current MIDI input device
 */
export function disconnectInput() {
  if (currentInput) {
    try {
      currentInput.removeAllListeners()
      currentInput.close()
      midiLogger.info('Disconnected from MIDI input')
    } catch (error) {
      midiLogger.error(`Error disconnecting input: ${error}`)
    }
    currentInput = null
  }
  config.inputDeviceId = null
}

/**
 * Connect to a MIDI output device by index
 */
export function connectOutput(deviceId: number): boolean {
  if (!loadMidi() || !easymidi) {
    midiLogger.warn('Cannot connect to output: MIDI not available')
    return false
  }

  // Disconnect existing output first
  disconnectOutput()

  try {
    const outputs = easymidi.getOutputs()
    if (deviceId < 0 || deviceId >= outputs.length) {
      midiLogger.error(`Invalid output device ID: ${deviceId}`)
      return false
    }

    const deviceName = outputs[deviceId]
    currentOutput = new easymidi.Output(deviceName)

    config.outputDeviceId = deviceId
    midiLogger.info(`Connected to MIDI output: ${deviceName}`)
    return true
  } catch (error) {
    midiLogger.error(`Failed to connect to output device ${deviceId}: ${error}`)
    currentOutput = null
    return false
  }
}

/**
 * Disconnect from current MIDI output device
 */
export function disconnectOutput() {
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
 * Set callback for MIDI messages
 */
export function setMessageCallback(callback: MIDIMessageCallback | null) {
  messageCallback = callback
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
        : null,
    outputDevice:
      config.outputDeviceId !== null
        ? outputs[config.outputDeviceId]?.name || null
        : null,
    inputDeviceId: config.inputDeviceId,
    outputDeviceId: config.outputDeviceId,
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
  disconnectInput()
  disconnectOutput()
}

// Export types
export type { MIDIConfig, MIDIDevice, MIDIInputMessage }

export { DEFAULT_MIDI_CONFIG } from './types'
