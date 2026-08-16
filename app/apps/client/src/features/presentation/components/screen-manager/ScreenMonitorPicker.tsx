import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { useMonitors, useUpsertScreen } from '../../hooks'
import type { Screen } from '../../types'
import {
  closeDisplayWindow,
  isTauri,
  openDisplayWindow,
} from '../../utils/openDisplayWindow'

/** Value standing for "no monitor chosen"; the Combobox cannot hold null. */
const AUTO = '__auto__'

interface ScreenMonitorPickerProps {
  screen: Screen
}

/**
 * Picks the physical display a screen projects onto.
 *
 * The same field is written when the operator drags the projection window to
 * another monitor, so the two ways of saying "put it there" agree. Choosing a
 * monitor for a screen whose window is already open reopens it, since a window
 * cannot be handed to another display while it is fullscreen on this one.
 */
export function ScreenMonitorPicker({ screen }: ScreenMonitorPickerProps) {
  const { t } = useTranslation(['settings', 'presentation'])
  const { data: monitors } = useMonitors()
  const upsertScreen = useUpsertScreen()

  const options = useMemo(() => {
    const list = monitors ?? []
    return [
      {
        value: AUTO,
        label: t('presentation:screens.monitor.auto'),
        description: t('presentation:screens.monitor.autoDescription'),
      },
      ...list.map((monitor, index) => ({
        value: monitor.name,
        label:
          monitor.osName ??
          t('presentation:screens.monitor.unnamed', { index: index + 1 }),
        description: `${monitor.width}×${monitor.height}`,
      })),
    ]
  }, [monitors, t])

  // Nothing to choose between in the browser, where the app cannot place a
  // window on a display at all.
  if (!isTauri()) return null

  const handleChange = async (value: number | string | null) => {
    const monitorName = value === AUTO || value === null ? null : String(value)
    if (monitorName === screen.monitorName) return

    await upsertScreen.mutateAsync({
      id: screen.id,
      name: screen.name,
      type: screen.type,
      monitorName,
    })

    if (screen.isActive) {
      await closeDisplayWindow(screen.id)
      await openDisplayWindow({ ...screen, monitorName }, 'native', false)
    }
  }

  // A monitor the screen names but that is not plugged in stays selected, so
  // unplugging a projector does not silently reassign the screen.
  const value =
    screen.monitorName === null
      ? AUTO
      : (options.find((option) => option.value === screen.monitorName)?.value ??
        screen.monitorName)

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {t('presentation:screens.monitor.label')}
      </span>
      <Combobox
        options={
          options.some((option) => option.value === value)
            ? options
            : [
                ...options,
                {
                  value,
                  label: t('presentation:screens.monitor.disconnected', {
                    name: screen.monitorName,
                  }),
                },
              ]
        }
        value={value}
        onChange={handleChange}
        allowClear={false}
        disabled={upsertScreen.isPending}
        className="w-56"
      />
    </div>
  )
}
