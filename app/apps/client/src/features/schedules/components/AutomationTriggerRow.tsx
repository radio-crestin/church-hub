import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { useOBSScenes } from '~/features/livestream/hooks'
import { NativeSelect } from '~/ui/select'
import type { AutomationTrigger, AutomationTriggerEvent } from '../types'

const EVENTS: AutomationTriggerEvent[] = [
  'scene_selected',
  'stream_started',
  'stream_stopped',
  'recording_started',
  'recording_stopped',
]

type Choice = AutomationTriggerEvent | 'never'

interface AutomationTriggerRowProps {
  label: string
  description: string
  trigger: AutomationTrigger | null
  onChange: (trigger: AutomationTrigger | null) => void
  testId: string
}

/**
 * What in OBS starts (or stops) the presentation: never, a scene being
 * selected (then which scene), or the livestream or recording starting or
 * stopping. Scenes are the ones set up in the livestream settings.
 */
export function AutomationTriggerRow({
  label,
  description,
  trigger,
  onChange,
  testId,
}: AutomationTriggerRowProps) {
  const { t } = useTranslation('schedules')
  const id = useId()
  const { scenes } = useOBSScenes(true)

  const sceneNames = scenes.map((scene) => scene.obsSceneName)
  // The scene saved may be hidden or gone: keep it listed, so it shows.
  if (trigger?.sceneName && !sceneNames.includes(trigger.sceneName)) {
    sceneNames.unshift(trigger.sceneName)
  }
  const sceneLabel = (name: string) =>
    scenes.find((scene) => scene.obsSceneName === name)?.displayName || name

  const events = EVENTS.filter(
    (event) => event !== 'scene_selected' || sceneNames.length > 0,
  )
  const choose = (choice: Choice) => {
    if (choice === 'never') onChange(null)
    else if (choice === 'scene_selected')
      onChange({ event: choice, sceneName: sceneNames[0] ?? null })
    else onChange({ event: choice, sceneName: null })
  }

  return (
    <div className="space-y-2 py-2">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-fg-hint">{description}</p>
      </div>
      <NativeSelect<Choice>
        id={id}
        value={trigger?.event ?? 'never'}
        options={[
          { value: 'never', label: t('automation.trigger.never') },
          ...events.map((event) => ({
            value: event,
            label: t(`automation.trigger.events.${event}`),
          })),
        ]}
        onChange={choose}
        testId={testId}
      />
      {trigger?.event === 'scene_selected' && (
        <NativeSelect
          id={`${id}-scene`}
          value={trigger.sceneName ?? ''}
          options={sceneNames.map((name) => ({
            value: name,
            label: sceneLabel(name),
          }))}
          onChange={(sceneName) => onChange({ ...trigger, sceneName })}
          testId={`${testId}-scene`}
        />
      )}
    </div>
  )
}
