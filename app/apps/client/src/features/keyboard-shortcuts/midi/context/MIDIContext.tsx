import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getApiUrl, getWsUrl } from '~/config'
import { createLogger } from '~/utils/logger'
import {
  DEFAULT_MIDI_CONFIG,
  type MIDIConfig,
  type MIDIDevice,
  type MIDIMessage,
} from '../types'

const logger = createLogger('midi:context')

type MIDIMessageCallback = (message: MIDIMessage) => void

interface MIDIContextValue {
  // State
  isSupported: boolean
  isEnabled: boolean
  hasPermission: boolean
  permissionError: string | null
  isReconnecting: boolean
  reconnectingDeviceName: string | null

  // Devices
  inputDevices: MIDIDevice[]
  outputDevices: MIDIDevice[]
  selectedInputId: string | null
  selectedOutputId: string | null

  // Actions
  requestAccess: () => Promise<boolean>
  selectInputDevice: (deviceId: string | null) => void
  selectOutputDevice: (deviceId: string | null) => void
  setEnabled: (enabled: boolean) => void

  // LED Control
  setLED: (note: number, on: boolean) => void
  setAllLEDs: (ledStates: Map<number, boolean>) => void

  // Event subscription
  subscribe: (callback: MIDIMessageCallback) => () => void
  subscribeToReconnection: (callback: () => void) => () => void

  // Config
  config: MIDIConfig
  updateConfig: (config: Partial<MIDIConfig>) => void
}

const MIDIContext = createContext<MIDIContextValue | null>(null)

interface MIDIProviderProps {
  children: React.ReactNode
  initialConfig?: MIDIConfig
  onConfigChange?: (config: MIDIConfig) => void
}

export function MIDIProvider({
  children,
  initialConfig = DEFAULT_MIDI_CONFIG,
  onConfigChange,
}: MIDIProviderProps) {
  // State
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectingDeviceName, setReconnectingDeviceName] = useState<
    string | null
  >(null)

  // Device lists
  const [inputDevices, setInputDevices] = useState<MIDIDevice[]>([])
  const [outputDevices, setOutputDevices] = useState<MIDIDevice[]>([])

  // Configuration
  const [config, setConfig] = useState<MIDIConfig>(initialConfig)

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribers for MIDI messages
  const subscribersRef = useRef<Set<MIDIMessageCallback>>(new Set())

  // Subscribers for reconnection events (to refresh LEDs)
  const reconnectionSubscribersRef = useRef<Set<() => void>>(new Set())

  // Ref to track isReconnecting for WebSocket closure (avoids stale closure issue)
  const isReconnectingRef = useRef(isReconnecting)

  // Keep the ref in sync with state
  useEffect(() => {
    isReconnectingRef.current = isReconnecting
  }, [isReconnecting])

  // Server-side MIDI is always supported
  const isSupported = true

  // Fetch available devices from server
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/midi/devices`)
      const result = await response.json()

      if (result.data) {
        const inputs: MIDIDevice[] = result.data.inputs.map(
          (d: { id: number; name: string }) => ({
            id: String(d.id),
            name: d.name,
            manufacturer: 'Unknown',
            state: 'connected',
          }),
        )
        const outputs: MIDIDevice[] = result.data.outputs.map(
          (d: { id: number; name: string }) => ({
            id: String(d.id),
            name: d.name,
            manufacturer: 'Unknown',
            state: 'connected',
          }),
        )

        setInputDevices(inputs)
        setOutputDevices(outputs)
        logger.debug('Fetched MIDI devices', { inputs, outputs })
      }
    } catch (error) {
      logger.error('Failed to fetch MIDI devices', { error })
    }
  }, [])

  // Connect to WebSocket for real-time MIDI messages
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const wsUrl = `${getWsUrl()}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setHasPermission(true)
        setPermissionError(null)

        // Sync MIDI status on WebSocket connect to handle reconnection during MIDI reconnection cycle
        fetch(`${getApiUrl()}/api/midi/status`)
          .then((res) => res.json())
          .then((result) => {
            if (result.data) {
              const newIsReconnecting = result.data.isReconnecting || false
              setIsReconnecting(newIsReconnecting)
              isReconnectingRef.current = newIsReconnecting
              setReconnectingDeviceName(
                result.data.reconnectingInputDevice ||
                  result.data.reconnectingOutputDevice ||
                  null,
              )
              logger.debug('Synced MIDI status on WebSocket connect', {
                isReconnecting: newIsReconnecting,
              })
            }
          })
          .catch((err) =>
            logger.error('Failed to fetch MIDI status on connect', { err }),
          )
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'midi_message') {
            const message: MIDIMessage = {
              type: data.payload.type,
              channel: data.payload.channel,
              note: data.payload.note,
              controller: data.payload.controller,
              value: data.payload.value,
              timestamp: data.payload.timestamp,
            }

            // Notify all subscribers
            subscribersRef.current.forEach((callback) => {
              try {
                callback(message)
              } catch (error) {
                logger.error('Error in MIDI message subscriber', { error })
              }
            })
          }

          if (data.type === 'midi_connection_status') {
            logger.debug('MIDI connection status', data.payload)
            // Use ref to get current value (avoids stale closure issue)
            const wasReconnecting = isReconnectingRef.current
            const newIsReconnecting = data.payload.isReconnecting

            setIsReconnecting(newIsReconnecting)

            // Set the reconnecting device name for display
            const deviceName =
              data.payload.reconnectingInputDevice ||
              data.payload.reconnectingOutputDevice
            setReconnectingDeviceName(deviceName)

            // Sync device IDs from server - device IDs can change after reconnection
            const serverInputId = data.payload.inputDeviceId
            const serverOutputId = data.payload.outputDeviceId
            if (serverInputId !== undefined || serverOutputId !== undefined) {
              setConfig((prev) => {
                const newInputId =
                  serverInputId !== null && serverInputId !== undefined
                    ? String(serverInputId)
                    : prev.inputDeviceId
                const newOutputId =
                  serverOutputId !== null && serverOutputId !== undefined
                    ? String(serverOutputId)
                    : prev.outputDeviceId

                // Only update if something changed
                if (
                  newInputId !== prev.inputDeviceId ||
                  newOutputId !== prev.outputDeviceId
                ) {
                  logger.info('Syncing device IDs from server', {
                    inputDeviceId: newInputId,
                    outputDeviceId: newOutputId,
                  })
                  const updated = {
                    ...prev,
                    inputDeviceId: newInputId,
                    outputDeviceId: newOutputId,
                  }
                  onConfigChange?.(updated)
                  return updated
                }
                return prev
              })
            }

            // If we just finished reconnecting, notify subscribers to refresh LEDs
            if (wasReconnecting && !newIsReconnecting) {
              logger.info(
                'MIDI device reconnected, notifying subscribers to refresh state',
              )

              // Helper to notify all reconnection subscribers
              const notifySubscribers = () => {
                reconnectionSubscribersRef.current.forEach((callback) => {
                  try {
                    callback()
                  } catch (error) {
                    logger.error('Error in reconnection subscriber', { error })
                  }
                })
              }

              // Delay to let the connection stabilize and server resetAllLEDs() to complete
              // Server resets all LEDs on connect, so we need to wait for that to finish
              setTimeout(() => {
                notifySubscribers()
                // Retry after another delay to ensure LEDs are properly set
                // (handles potential race conditions with server LED reset)
                setTimeout(() => {
                  logger.debug('Retrying LED refresh after reconnection')
                  notifySubscribers()
                }, 200)
              }, 200)
            }
          }

          if (data.type === 'midi_devices') {
            logger.debug('MIDI devices update', data.payload)
            fetchDevices()
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error })
        }
      }

      ws.onerror = (error) => {
        logger.error('WebSocket error', { error })
        setPermissionError('WebSocket connection error')
      }

      ws.onclose = () => {
        logger.info('WebSocket disconnected')

        // Reconnect after delay if enabled
        if (config.enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            logger.debug('Reconnecting WebSocket...')
            connectWebSocket()
          }, 3000)
        }
      }
    } catch (error) {
      logger.error('Failed to connect WebSocket', { error })
      setPermissionError('Failed to connect to MIDI service')
    }
  }, [config.enabled, fetchDevices])

  // Request access (connect to server)
  const requestAccess = useCallback(async (): Promise<boolean> => {
    try {
      // Fetch devices
      await fetchDevices()

      // Connect to WebSocket
      connectWebSocket()

      // Auto-connect to saved devices if we have them
      const inputId = config.inputDeviceId
        ? parseInt(config.inputDeviceId, 10)
        : null
      const outputId = config.outputDeviceId
        ? parseInt(config.outputDeviceId, 10)
        : null

      if (inputId !== null || outputId !== null) {
        try {
          const response = await fetch(`${getApiUrl()}/api/midi/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inputDeviceId: inputId,
              outputDeviceId: outputId,
            }),
          })
          const _result = await response.json()
        } catch (_error) {}
      } else {
      }

      return true
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error requesting MIDI access'
      logger.error('MIDI access request failed', { error: message })
      setPermissionError(message)
      return false
    }
  }, [
    fetchDevices,
    connectWebSocket,
    config.inputDeviceId,
    config.outputDeviceId,
  ])

  // Connect to devices on server
  const connectToDevices = useCallback(
    async (inputId: number | null, outputId: number | null) => {
      try {
        const response = await fetch(`${getApiUrl()}/api/midi/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputDeviceId: inputId,
            outputDeviceId: outputId,
          }),
        })

        const result = await response.json()
        logger.debug('MIDI connect result', result)
        return result.data
      } catch (error) {
        logger.error('Failed to connect MIDI devices', { error })
        return null
      }
    },
    [],
  )

  // Select input device
  const selectInputDevice = useCallback(
    (deviceId: string | null) => {
      const numericId = deviceId ? parseInt(deviceId, 10) : null

      setConfig((prev) => {
        const updated = { ...prev, inputDeviceId: deviceId }
        onConfigChange?.(updated)
        return updated
      })

      connectToDevices(
        numericId,
        config.outputDeviceId ? parseInt(config.outputDeviceId, 10) : null,
      )
    },
    [config.outputDeviceId, connectToDevices, onConfigChange],
  )

  // Select output device
  const selectOutputDevice = useCallback(
    (deviceId: string | null) => {
      const numericId = deviceId ? parseInt(deviceId, 10) : null

      setConfig((prev) => {
        const updated = { ...prev, outputDeviceId: deviceId }
        onConfigChange?.(updated)
        return updated
      })

      connectToDevices(
        config.inputDeviceId ? parseInt(config.inputDeviceId, 10) : null,
        numericId,
      )
    },
    [config.inputDeviceId, connectToDevices, onConfigChange],
  )

  // Set enabled state
  const setEnabled = useCallback(
    (enabled: boolean) => {
      setConfig((prev) => {
        const updated = { ...prev, enabled }
        onConfigChange?.(updated)
        return updated
      })

      if (enabled) {
        requestAccess()
      } else {
        // Disconnect WebSocket
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }

        // Disconnect devices on server
        fetch(`${getApiUrl()}/api/midi/disconnect`, { method: 'POST' }).catch(
          (error) => logger.error('Failed to disconnect', { error }),
        )
      }
    },
    [onConfigChange, requestAccess],
  )

  // Update config
  const updateConfig = useCallback(
    (updates: Partial<MIDIConfig>) => {
      setConfig((prev) => {
        const updated = { ...prev, ...updates }
        onConfigChange?.(updated)
        return updated
      })

      // Handle device changes
      if (
        updates.inputDeviceId !== undefined ||
        updates.outputDeviceId !== undefined
      ) {
        const inputId = updates.inputDeviceId ?? config.inputDeviceId
        const outputId = updates.outputDeviceId ?? config.outputDeviceId
        connectToDevices(
          inputId ? parseInt(inputId, 10) : null,
          outputId ? parseInt(outputId, 10) : null,
        )
      }
    },
    [
      config.inputDeviceId,
      config.outputDeviceId,
      connectToDevices,
      onConfigChange,
    ],
  )

  // Set single LED via WebSocket
  const setLED = useCallback((note: number, on: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logger.debug('Cannot set LED: WebSocket not connected')
      return
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'midi_set_led',
          payload: { note, on },
        }),
      )
      logger.debug(`LED ${note} set to ${on ? 'ON' : 'OFF'}`)
    } catch (error) {
      logger.error('Error sending LED message', { error, note, on })
    }
  }, [])

  // Set multiple LEDs at once
  const setAllLEDs = useCallback((ledStates: Map<number, boolean>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logger.debug('Cannot set LEDs: WebSocket not connected')
      return
    }

    const ledArray: Array<{ note: number; on: boolean }> = []
    ledStates.forEach((on, note) => {
      ledArray.push({ note, on })
    })

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'midi_set_all_leds',
          payload: { ledStates: ledArray },
        }),
      )
    } catch (error) {
      logger.error('Error sending LED messages', { error })
    }
  }, [])

  // Subscribe to MIDI messages
  const subscribe = useCallback(
    (callback: MIDIMessageCallback): (() => void) => {
      subscribersRef.current.add(callback)

      return () => {
        subscribersRef.current.delete(callback)
      }
    },
    [],
  )

  // Subscribe to reconnection events (for refreshing LEDs after reconnection)
  const subscribeToReconnection = useCallback(
    (callback: () => void): (() => void) => {
      reconnectionSubscribersRef.current.add(callback)

      return () => {
        reconnectionSubscribersRef.current.delete(callback)
      }
    },
    [],
  )

  // Use ref for requestAccess to avoid dependency array issues
  const requestAccessRef = useRef(requestAccess)
  requestAccessRef.current = requestAccess

  // Auto-connect if enabled
  useEffect(() => {
    if (config.enabled) {
      requestAccessRef.current()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [config.enabled]) // Only re-run when enabled changes

  // Sync config from initialConfig prop changes
  useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  const value: MIDIContextValue = useMemo(
    () => ({
      isSupported,
      isEnabled: config.enabled,
      hasPermission,
      permissionError,
      isReconnecting,
      reconnectingDeviceName,
      inputDevices,
      outputDevices,
      selectedInputId: config.inputDeviceId,
      selectedOutputId: config.outputDeviceId,
      requestAccess,
      selectInputDevice,
      selectOutputDevice,
      setEnabled,
      setLED,
      setAllLEDs,
      subscribe,
      subscribeToReconnection,
      config,
      updateConfig,
    }),
    [
      isSupported,
      config,
      hasPermission,
      permissionError,
      isReconnecting,
      reconnectingDeviceName,
      inputDevices,
      outputDevices,
      requestAccess,
      selectInputDevice,
      selectOutputDevice,
      setEnabled,
      setLED,
      setAllLEDs,
      subscribe,
      subscribeToReconnection,
      updateConfig,
    ],
  )

  return <MIDIContext.Provider value={value}>{children}</MIDIContext.Provider>
}

export function useMIDI(): MIDIContextValue {
  const context = useContext(MIDIContext)
  if (!context) {
    throw new Error('useMIDI must be used within a MIDIProvider')
  }
  return context
}

/**
 * Optional hook that returns null if not in MIDIProvider
 * Useful for components that may or may not have MIDI support
 */
export function useMIDIOptional(): MIDIContextValue | null {
  return useContext(MIDIContext)
}
