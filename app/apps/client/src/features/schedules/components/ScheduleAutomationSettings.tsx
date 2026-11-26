import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Slider } from '~/ui/slider'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast'
import { AutomationTriggerRow } from './AutomationTriggerRow'
import { useUpsertSchedule } from '../hooks'
import type { Schedule, ScheduleAutomationSettings as Settings } from '../types'

const DEFAULT_AUTOPLAY_SECONDS = 5
const DEFAULT_MUSIC_VOLUME = 50
/** Typing a number or dragging the volume saves once it settles. */
const SAVE_DELAY_MS = 500

interface ScheduleAutomationSettingsProps {
  schedule: Pick<Schedule, 'id' | 'title' | 'description'> & {
    automation: Settings
  }
}

/**
 * The automation settings, one under the other: autoplay (seconds per slide,
 * longer for more text), loop, the music volume, starting with Church Hub,
 * and what in OBS starts and stops it.
 * Each change is saved as it is made. An item's own time is set beside it in
 * the items list.
 */
export function ScheduleAutomationSettings({
  schedule,
}: ScheduleAutomationSettingsProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const upsertSchedule = useUpsertSchedule()
  const { automation } = schedule

  const [seconds, setSeconds] = useState(
    automation.autoplaySeconds ?? DEFAULT_AUTOPLAY_SECONDS,
  )
  const [volume, setVolume] = useState(
    automation.musicVolume ?? DEFAULT_MUSIC_VOLUME,
  )

  useEffect(() => {
    setSeconds(automation.autoplaySeconds ?? DEFAULT_AUTOPLAY_SECONDS)
    setVolume(automation.musicVolume ?? DEFAULT_MUSIC_VOLUME)
  }, [automation.autoplaySeconds, automation.musicVolume])

  const save = async (patch: Partial<Settings>) => {
    // The upsert rewrites title and description too, so they ride along.
    const result = await upsertSchedule.mutateAsync({
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      automation: patch,
    })
    if (!result.success) showToast(t('messages.error'), 'error')
  }

  // A latest-value ref, so the delayed saves below never use a stale `save`.
  const saveRef = useRef(save)
  saveRef.current = save

  const autoplayOn = automation.autoplaySeconds != null
  useEffect(() => {
    if (!autoplayOn || seconds === automation.autoplaySeconds) return
    if (!Number.isFinite(seconds) || seconds < 1) return
    const timer = setTimeout(
      () => saveRef.current({ autoplaySeconds: seconds }),
      SAVE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [autoplayOn, seconds, automation.autoplaySeconds])

  const volumeOn = automation.musicVolume != null
  useEffect(() => {
    if (!volumeOn || volume === automation.musicVolume) return
    const timer = setTimeout(
      () => saveRef.current({ musicVolume: volume }),
      SAVE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [volumeOn, volume, automation.musicVolume])

  return (
    <div className="divide-y divide-line">
      <div>
        <SwitchRow
          label={t('automation.autoplay')}
          description={t('automation.autoplayDescription')}
          checked={autoplayOn}
          onCheckedChange={(on) =>
            save({ autoplaySeconds: on ? seconds : null })
          }
          testId="automation-autoplay"
        />
        {autoplayOn && (
          <label className="flex items-center justify-between gap-3 pb-2 text-[13px] text-fg-body">
            {t('automation.seconds')}
            <input
              type="number"
              min={1}
              max={3600}
              value={Number.isFinite(seconds) ? seconds : ''}
              onChange={(e) => setSeconds(e.target.valueAsNumber)}
              data-testid="automation-seconds"
              className="w-20 rounded-lg border border-line bg-panel px-2 py-1 text-right text-fg"
            />
          </label>
        )}
        {autoplayOn && (
          <SwitchRow
            label={t('automation.byText')}
            description={t('automation.byTextDescription')}
            checked={automation.autoplayByText}
            onCheckedChange={(autoplayByText) => save({ autoplayByText })}
            testId="automation-by-text"
          />
        )}
      </div>
      <SwitchRow
        label={t('automation.loop')}
        description={t('automation.loopDescription')}
        checked={automation.loop}
        onCheckedChange={(loop) => save({ loop })}
        testId="automation-loop"
      />
      <div>
        <SwitchRow
          label={t('automation.musicVolume')}
          description={t('automation.musicVolumeDescription')}
          checked={volumeOn}
          onCheckedChange={(on) => save({ musicVolume: on ? volume : null })}
          testId="automation-music-volume"
        />
        {volumeOn && (
          <Slider
            value={[volume]}
            onValueChange={([value]) => setVolume(value ?? volume)}
            min={0}
            max={100}
            formatValue={(value) => `${value}%`}
            testId="automation-volume-slider"
            className="pb-2"
          />
        )}
      </div>
      <SwitchRow
        label={t('automation.startOnAppStart')}
        description={t('automation.startOnAppStartDescription')}
        checked={automation.startOnAppStart}
        onCheckedChange={(startOnAppStart) => save({ startOnAppStart })}
        testId="automation-start-on-app-start"
      />
      <AutomationTriggerRow
        label={t('automation.trigger.start')}
        description={t('automation.trigger.startDescription')}
        trigger={automation.startTrigger}
        onChange={(startTrigger) => save({ startTrigger })}
        testId="automation-start-trigger"
      />
      <AutomationTriggerRow
        label={t('automation.trigger.stop')}
        description={t('automation.trigger.stopDescription')}
        trigger={automation.stopTrigger}
        onChange={(stopTrigger) => save({ stopTrigger })}
        testId="automation-stop-trigger"
      />
    </div>
  )
}
