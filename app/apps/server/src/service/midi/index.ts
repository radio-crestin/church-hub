import easymidi from 'easymidi'

import {
  DEFAULT_MIDI_CONFIG,
  LED_VELOCITY_OFF,
  LED_VELOCITY_ON,
  type MIDIConfig,
  type MIDIDevice,
  type MIDIInputMessage,
} from './types'
import { midiLogger } from '../../utils/fileLogger'

// Current state
let config: MIDIConfig = { ...DEFAULT_MIDI_CONFIG }
let currentInput: easymidi.Input | null = null
let currentOutput: easymidi.Output | null = null

// Callback for MIDI messages to be sent via WebSocket
type MIDIMessageCallback = (message: MIDIInputMessage) => void
let messageCallback: MIDIMessageCallback | null = null

/**
 * Get list of available MIDI input devices
 */
export function getInputDevices(): MIDIDevice[] {
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
 * Get current MIDI connection status
 */
export function getConnectionStatus() {
  const inputs = getInputDevices()
  const outputs = getOutputDevices()

  return {
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
