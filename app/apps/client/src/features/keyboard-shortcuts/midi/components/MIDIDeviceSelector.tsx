import { Music2, Power, RefreshCw, Usb } from 'lucide-react'
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
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
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
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Music2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.shortcuts.midi.title', {
                defaultValue: 'MIDI Controller',
              })}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
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
            ${midi.isEnabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}
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
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
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
        <div className="space-y-3 pl-10">
          {/* Refresh button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t('sections.shortcuts.midi.refresh', {
                defaultValue: 'Refresh devices',
              })}
            </button>
          </div>

          {/* Input device selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Usb className="w-4 h-4" />
              {t('sections.shortcuts.midi.inputDevice', {
                defaultValue: 'Input Device',
              })}
            </label>
            <Combobox
              options={inputDeviceOptions}
              value={midi.selectedInputId}
              onChange={(value) =>
                midi.selectInputDevice(value as string | null)
              }
              placeholder={t('sections.shortcuts.midi.selectDevice', {
                defaultValue: 'Select device...',
              })}
              allowClear
            />
            {midi.inputDevices.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.shortcuts.midi.noInputDevices', {
                  defaultValue: 'No MIDI input devices detected',
                })}
              </p>
            )}
          </div>

          {/* Output device selector (for LEDs) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Power className="w-4 h-4" />
              {t('sections.shortcuts.midi.outputDevice', {
                defaultValue: 'Output Device (LEDs)',
              })}
            </label>
            <Combobox
              options={outputDeviceOptions}
              value={midi.selectedOutputId}
              onChange={(value) =>
                midi.selectOutputDevice(value as string | null)
              }
              placeholder={t('sections.shortcuts.midi.selectDevice', {
                defaultValue: 'Select device...',
              })}
              allowClear
            />
            {midi.outputDevices.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.shortcuts.midi.noOutputDevices', {
                  defaultValue: 'No MIDI output devices detected',
                })}
              </p>
            )}
          </div>

          {/* Connection status */}
          {(midi.selectedInputId || midi.selectedOutputId) && (
            <div className="flex items-center gap-2 pt-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  midi.selectedInputId && midi.selectedOutputId
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {midi.selectedInputId && midi.selectedOutputId
                  ? t('sections.shortcuts.midi.fullyConnected', {
                      defaultValue: 'Input and output connected',
                    })
                  : midi.selectedInputId
                    ? t('sections.shortcuts.midi.inputOnly', {
                        defaultValue: 'Input connected (no LED feedback)',
                      })
                    : t('sections.shortcuts.midi.outputOnly', {
                        defaultValue: 'Output connected (no triggers)',
                      })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Request permission prompt */}
      {midi.isEnabled && !midi.hasPermission && !midi.permissionError && (
        <div className="pl-10">
          <button
            type="button"
            onClick={() => midi.requestAccess()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
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
