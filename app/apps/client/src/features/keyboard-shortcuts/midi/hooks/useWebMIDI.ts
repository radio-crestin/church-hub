/**
 * Web MIDI API hook for browser-based MIDI support
 * Used as a fallback when server-side native MIDI is not available
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import type { MIDIDevice, MIDIMessage } from '../types'

const logger = createLogger('midi:web-midi')

interface WebMIDIState {
  isSupported: boolean
  hasPermission: boolean
  permissionError: string | null
  inputDevices: MIDIDevice[]
  outputDevices: MIDIDevice[]
}

interface UseWebMIDIReturn extends WebMIDIState {
  requestAccess: () => Promise<boolean>
  connectInput: (deviceId: string) => void
  disconnectInput: () => void
  connectOutput: (deviceId: string) => void
  disconnectOutput: () => void
  setLED: (note: number, on: boolean) => void
  setAllLEDs: (ledStates: Array<{ note: number; on: boolean }>) => void
  subscribe: (callback: (message: MIDIMessage) => void) => () => void
  refreshDevices: () => void
}

export function useWebMIDI(): UseWebMIDIReturn {
  const [state, setState] = useState<WebMIDIState>({
    isSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
    hasPermission: false,
    permissionError: null,
    inputDevices: [],
    outputDevices: [],
  })

  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const currentInputRef = useRef<MIDIInput | null>(null)
  const currentOutputRef = useRef<MIDIOutput | null>(null)
  const subscribersRef = useRef<Set<(message: MIDIMessage) => void>>(new Set())

  // Convert Web MIDI device to our MIDIDevice format
  const convertDevice = useCallback((device: MIDIInput | MIDIOutput): MIDIDevice => ({
    id: device.id,
    name: device.name || 'Unknown Device',
    manufacturer: device.manufacturer || 'Unknown',
    state: device.state === 'connected' ? 'connected' : 'disconnected',
  }), [])

  // Update device lists from MIDIAccess
  const updateDeviceLists = useCallback(() => {
    if (!midiAccessRef.current) return

    const inputs: MIDIDevice[] = []
    const outputs: MIDIDevice[] = []

    midiAccessRef.current.inputs.forEach((input) => {
      inputs.push(convertDevice(input))
    })

    midiAccessRef.current.outputs.forEach((output) => {
      outputs.push(convertDevice(output))
    })

    logger.debug('Web MIDI devices updated', { inputs: inputs.length, outputs: outputs.length })

    setState((prev) => ({
      ...prev,
      inputDevices: inputs,
      outputDevices: outputs,
    }))
  }, [convertDevice])

  // Handle MIDI message from input device
  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data
    if (!data || data.length < 2) return

    const status = data[0]
    const channel = status & 0x0f
    const messageType = status & 0xf0

    let message: MIDIMessage | null = null

    if (messageType === 0x90) {
      // Note On (velocity > 0) or Note Off (velocity === 0)
      const velocity = data[2]
      message = {
        type: velocity > 0 ? 'note_on' : 'note_off',
        channel,
        note: data[1],
        value: velocity,
        timestamp: event.timeStamp || Date.now(),
      }
    } else if (messageType === 0x80) {
      // Note Off
      message = {
        type: 'note_off',
        channel,
        note: data[1],
        value: data[2],
        timestamp: event.timeStamp || Date.now(),
      }
    } else if (messageType === 0xb0) {
      // Control Change
      message = {
        type: 'control_change',
        channel,
        controller: data[1],
        value: data[2],
        timestamp: event.timeStamp || Date.now(),
      }
    }

    if (message) {
      logger.debug('Web MIDI message received', message)
      subscribersRef.current.forEach((callback) => {
        try {
          callback(message)
        } catch (error) {
          logger.error('Error in MIDI subscriber callback', { error })
        }
      })
    }
  }, [])

  // Request MIDI access
  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        permissionError: 'Web MIDI API is not supported in this browser',
      }))
      return false
    }

    try {
      logger.info('Requesting Web MIDI access...')
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false })
      midiAccessRef.current = midiAccess

      // Listen for device changes
      midiAccess.onstatechange = () => {
        logger.debug('MIDI state change detected')
        updateDeviceLists()
      }

      updateDeviceLists()

      setState((prev) => ({
        ...prev,
        hasPermission: true,
        permissionError: null,
      }))

      logger.info('Web MIDI access granted')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access MIDI devices'
      logger.error('Web MIDI access denied', { error: errorMessage })
      setState((prev) => ({
        ...prev,
        hasPermission: false,
        permissionError: errorMessage,
      }))
      return false
    }
  }, [state.isSupported, updateDeviceLists])

  // Connect to input device
  const connectInput = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) {
      logger.warn('Cannot connect input: MIDI access not granted')
      return
    }

    // Disconnect current input first
    if (currentInputRef.current) {
      currentInputRef.current.onmidimessage = null
      currentInputRef.current = null
    }

    const input = midiAccessRef.current.inputs.get(deviceId)
    if (!input) {
      logger.error('Input device not found', { deviceId })
      return
    }

    input.onmidimessage = handleMIDIMessage
    currentInputRef.current = input
    logger.info('Connected to Web MIDI input', { deviceId, name: input.name })
  }, [handleMIDIMessage])

  // Disconnect input
  const disconnectInput = useCallback(() => {
    if (currentInputRef.current) {
      currentInputRef.current.onmidimessage = null
      currentInputRef.current = null
      logger.info('Disconnected from Web MIDI input')
    }
  }, [])

  // Connect to output device
  const connectOutput = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) {
      logger.warn('Cannot connect output: MIDI access not granted')
      return
    }

    // Disconnect current output first
    currentOutputRef.current = null

    const output = midiAccessRef.current.outputs.get(deviceId)
    if (!output) {
      logger.error('Output device not found', { deviceId })
      return
    }

    currentOutputRef.current = output
    logger.info('Connected to Web MIDI output', { deviceId, name: output.name })
  }, [])

  // Disconnect output
  const disconnectOutput = useCallback(() => {
    currentOutputRef.current = null
    logger.info('Disconnected from Web MIDI output')
  }, [])

  // Set LED (send note on with velocity)
  const setLED = useCallback((note: number, on: boolean) => {
    if (!currentOutputRef.current) {
      logger.debug('Cannot set LED: no output device connected')
      return
    }

    try {
      // Send Note On with velocity 1 (on) or 0 (off) on channel 0
      const velocity = on ? 0x01 : 0x00
      currentOutputRef.current.send([0x90, note, velocity])
      logger.debug(`Web MIDI LED ${note} set to ${on ? 'ON' : 'OFF'}`)
    } catch (error) {
      logger.error('Error setting LED via Web MIDI', { error, note, on })
    }
  }, [])

  // Set multiple LEDs
  const setAllLEDs = useCallback((ledStates: Array<{ note: number; on: boolean }>) => {
    for (const { note, on } of ledStates) {
      setLED(note, on)
    }
  }, [setLED])

  // Subscribe to MIDI messages
  const subscribe = useCallback((callback: (message: MIDIMessage) => void): (() => void) => {
    subscribersRef.current.add(callback)
    return () => {
      subscribersRef.current.delete(callback)
    }
  }, [])

  // Refresh device list
  const refreshDevices = useCallback(() => {
    updateDeviceLists()
  }, [updateDeviceLists])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentInputRef.current) {
        currentInputRef.current.onmidimessage = null
      }
      currentInputRef.current = null
      currentOutputRef.current = null
      subscribersRef.current.clear()
    }
  }, [])

  return {
    ...state,
    requestAccess,
    connectInput,
    disconnectInput,
    connectOutput,
    disconnectOutput,
    setLED,
    setAllLEDs,
    subscribe,
    refreshDevices,
  }
}
