import { Loader2, Music2, Power, RefreshCw, Usb } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox'
import { useMIDI } from '../context'

export function MIDIDeviceSelector() {
  const { t } = useTranslation('settings')
  const midi = useMIDI()

  const inputDeviceOptions = useMemo(
    () =>
      midi.inputDevices.map((device) => ({
        value: device.id,
        label:
          device.manufacturer && device.manufacturer !== 'Unknown'
            ? `${device.name} (${device.manufacturer})`
            : device.name,
      })),
    [midi.inputDevices],
  )

  const outputDeviceOptions = useMemo(
    () =>
      midi.outputDevices.map((device) => ({
        value: device.id,
        label:
          device.manufacturer && device.manufacturer !== 'Unknown'
            ? `${device.name} (${device.manufacturer})`
            : device.name,
      })),
    [midi.outputDevices],
  )

  const handleToggleEnabled = () => {
    if (!midi.hasPermission && !midi.isEnabled) {
      midi.requestAccess().then((granted) => {
        if (granted) {
          midi.setEnabled(true)
        }
      })
    } else {
      midi.setEnabled(!midi.isEnabled)
    }
  }

  const handleRefresh = () => {
    midi.requestAccess()
  }

  if (!midi.isSupported) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t('sections.shortcuts.midi.notSupported', {
            defaultValue:
              'Web MIDI API is not supported in this browser. MIDI controller features are unavailable.',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with enable toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Music2
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-label"
          />
          <div>
            <h4 className="text-sm font-medium text-fg">
              {t('sections.shortcuts.midi.title', {
                defaultValue: 'MIDI Controller',
              })}
            </h4>
            <p className="text-xs text-fg-hint">
              {t('sections.shortcuts.midi.description', {
                defaultValue:
                  'Use hardware MIDI controllers for shortcuts with LED feedback',
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${midi.isEnabled ? 'bg-primary' : 'bg-line-strong'}
          `}
          role="switch"
          aria-checked={midi.isEnabled}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${midi.isEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Permission error */}
      {midi.permissionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-300">
            {t('sections.shortcuts.midi.permissionError', {
              defaultValue: 'MIDI access denied: {{error}}',
              error: midi.permissionError,
            })}
          </p>
        </div>
      )}

      {/* Device selectors (only shown when enabled) */}
      {midi.isEnabled && midi.hasPermission && (
        <div className="space-y-3 pl-7">
          {/* Refresh button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-fg-label hover:bg-hover hover:text-fg transition-colors"
            >
              <RefreshCw size={12} strokeWidth={2} />
              {t('sections.shortcuts.midi.refresh', {
                defaultValue: 'Refresh devices',
              })}
            </button>
          </div>

          {/* Input device selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-fg-label">
              <Usb size={16} strokeWidth={1.5} />
              {t('sections.shortcuts.midi.inputDevice', {
                defaultValue: 'Input Device',
              })}
            </label>
            <Combobox
              options={inputDeviceOptions}
              value={midi.selectedInputName}
              onChange={(value) =>
                midi.selectInputDevice(value as string | null)
              }
              placeholder={t('sections.shortcuts.midi.selectDevice', {
                defaultValue: 'Select device...',
              })}
              allowClear
            />
            {midi.inputDevices.length === 0 && (
              <p className="text-xs text-fg-hint">
                {t('sections.shortcuts.midi.noInputDevices', {
                  defaultValue: 'No MIDI input devices detected',
                })}
              </p>
            )}
          </div>

          {/* Output device selector (for LEDs) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-fg-label">
              <Power size={16} strokeWidth={1.5} />
              {t('sections.shortcuts.midi.outputDevice', {
                defaultValue: 'Output Device (LEDs)',
              })}
            </label>
            <Combobox
              options={outputDeviceOptions}
              value={midi.selectedOutputName}
              onChange={(value) =>
                midi.selectOutputDevice(value as string | null)
              }
              placeholder={t('sections.shortcuts.midi.selectDevice', {
                defaultValue: 'Select device...',
              })}
              allowClear
            />
            {midi.outputDevices.length === 0 && (
              <p className="text-xs text-fg-hint">
                {t('sections.shortcuts.midi.noOutputDevices', {
                  defaultValue: 'No MIDI output devices detected',
                })}
              </p>
            )}
          </div>

          {/* Connection status */}
          {(midi.selectedInputName ||
            midi.selectedOutputName ||
            midi.isReconnecting) && (
            <div className="flex items-center gap-2 pt-2">
              {midi.isReconnecting ? (
                <>
                  <Loader2
                    size={12}
                    strokeWidth={2}
                    className="text-amber-600 dark:text-amber-400 animate-spin"
                  />
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t('sections.shortcuts.midi.reconnecting', {
                      defaultValue: 'Reconnecting to {{device}}...',
                      device:
                        midi.reconnectingDeviceName ||
                        t('sections.shortcuts.midi.device', {
                          defaultValue: 'device',
                        }),
                    })}
                  </span>
                </>
              ) : (
                <>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      midi.selectedInputName && midi.selectedOutputName
                        ? 'bg-ok'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs text-fg-hint">
                    {midi.selectedInputName && midi.selectedOutputName
                      ? t('sections.shortcuts.midi.fullyConnected', {
                          defaultValue: 'Input and output connected',
                        })
                      : midi.selectedInputName
                        ? t('sections.shortcuts.midi.inputOnly', {
                            defaultValue: 'Input connected (no LED feedback)',
                          })
                        : t('sections.shortcuts.midi.outputOnly', {
                            defaultValue: 'Output connected (no triggers)',
                          })}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Request permission prompt */}
      {midi.isEnabled && !midi.hasPermission && !midi.permissionError && (
        <div className="pl-7">
          <button
            type="button"
            onClick={() => midi.requestAccess()}
            className="h-8 px-3 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg transition-colors"
          >
            {t('sections.shortcuts.midi.requestPermission', {
              defaultValue: 'Grant MIDI Access',
            })}
          </button>
        </div>
      )}
    </div>
  )
}
