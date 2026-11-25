import {
  ChevronRight,
  Copy,
  CopyPlus,
  Edit,
  ExternalLink,
  Monitor,
  MonitorOff,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenSceneTemplates } from '~/features/slide-templates/components/ScreenSceneTemplates'
import { ScreenTemplateSettings } from '~/features/slide-templates/components/ScreenTemplateSettings'
import { TemplateThumbnail } from '~/features/slide-templates/components/TemplateThumbnail'
import { useSlideTemplate } from '~/features/slide-templates/hooks/useSlideTemplates'
import { templateDisplayName } from '~/features/slide-templates/utils/templateDisplayName'
import { Button } from '~/ui/button/Button'
import { ActionMenu, type ActionMenuItem } from '~/ui/menu'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast/useToast'
import { PreviewScreenRadio } from './PreviewScreenRadio'
import { ScreenMonitorPicker } from './ScreenMonitorPicker'
import {
  useScreen,
  useUpdateScreenContentConfig,
  useUpsertScreen,
} from '../../hooks'
import type { Screen } from '../../types'
import {
  closeDisplayWindow,
  openDisplayWindow,
  setDisplayAlwaysOnTop,
} from '../../utils/openDisplayWindow'

/**
 * The per-screen switches saved straight from the card, each with the i18n
 * group (`sections.screens.<group>`) holding its toasts.
 */
const SWITCH_MESSAGES = {
  openOnStartup: 'openOnStartup',
  isFullscreen: 'fullscreen',
  alwaysOnTop: 'alwaysOnTop',
  closeOnEscape: 'closeOnEscape',
} as const

type ScreenSwitch = keyof typeof SWITCH_MESSAGES

interface ScreenCardProps {
  screen: Screen
  onEdit: () => void
  onExport: () => void
  onCopyUrl: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDuplicating: boolean
  /** The previews mirror this screen (chosen, or the main one by default). */
  isShownInPreviews: boolean
}

function SettingsGroup({
  title,
  testId,
  children,
}: {
  title: string
  testId: string
  children: ReactNode
}) {
  return (
    <section data-testid={testId} className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h4>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {children}
      </div>
    </section>
  )
}

/**
 * The chosen screen in Settings → Screens, in the order an operator asks:
 * how it looks (a large preview and every template to pick from), what it
 * shows when nothing is live, and where it appears. The rarely changed
 * options wait under "More options".
 */
export function ScreenCard({
  screen,
  onEdit,
  onExport,
  onCopyUrl,
  onDuplicate,
  onDelete,
  isDuplicating,
  isShownInPreviews,
}: ScreenCardProps) {
  const { t } = useTranslation(['settings', 'presentation'])
  const { showToast } = useToast()
  const upsertScreen = useUpsertScreen()
  const updateContentConfig = useUpdateScreenContentConfig()
  const { data: screenWithConfigs } = useScreen(screen.id)
  const { data: template } = useSlideTemplate(screen.templateId)
  const emptySlide = screenWithConfigs?.contentConfigs.empty

  const save = async (key: ScreenSwitch, value: boolean) => {
    const keyPrefix = `sections.screens.${SWITCH_MESSAGES[key]}`
    try {
      await upsertScreen.mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        [key]: value,
      })
      // An open window follows at once; the others take it when they open.
      if (key === 'alwaysOnTop' && screen.isActive) {
        await setDisplayAlwaysOnTop(screen.id, value)
      }
      showToast(t(`${keyPrefix}.${value ? 'enabled' : 'disabled'}`), 'success')
    } catch {
      showToast(t(`${keyPrefix}.error`), 'error')
    }
  }

  // Open or close the window now (persisted through isActive).
  const toggleWindow = async (open: boolean) => {
    try {
      await upsertScreen.mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        isActive: open,
      })
      if (open) await openDisplayWindow({ ...screen, isActive: true })
      else await closeDisplayWindow(screen.id)
      showToast(
        t(`sections.screens.toast.${open ? 'windowOpened' : 'windowClosed'}`, {
          name: screen.name,
        }),
        'success',
      )
    } catch {
      showToast(t('sections.screens.toast.toggleError'), 'error')
    }
  }

  const toggleIdleClock = async (clockEnabled: boolean) => {
    if (!emptySlide) return
    try {
      await updateContentConfig.mutateAsync({
        screenId: screen.id,
        contentType: 'empty',
        config: { ...emptySlide, clockEnabled },
      })
      showToast(t('sections.screens.toast.saved'), 'success')
    } catch {
      showToast(t('sections.screens.toast.saveError'), 'error')
    }
  }

  const busy = upsertScreen.isPending

  const actions: ActionMenuItem[] = [
    {
      id: 'export',
      label: t('sections.screens.export.title'),
      icon: <ExternalLink size={18} />,
      onSelect: onExport,
      testId: 'screen-export',
    },
    {
      id: 'copy-url',
      label: t('sections.screens.actions.copyUrl'),
      icon: <Copy size={18} />,
      onSelect: onCopyUrl,
      testId: 'screen-copy-url',
    },
    {
      id: 'duplicate',
      label: t('sections.screens.actions.duplicate'),
      icon: <CopyPlus size={18} />,
      onSelect: onDuplicate,
      disabled: isDuplicating,
      testId: 'screen-duplicate',
    },
    {
      id: 'delete',
      label: t('sections.screens.actions.delete'),
      icon: <Trash2 size={18} />,
      iconClassName:
        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      onSelect: onDelete,
      testId: 'screen-delete',
    },
  ]

  return (
    <div
      data-testid="screen-card"
      data-screen-id={screen.id}
      className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* What it is, its window, and the screen's other actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {screen.name}
          </h3>
          <p
            data-testid="screen-window-status"
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {t(`presentation:screens.screenTypes.${screen.type}`)} ·{' '}
            {screen.width}×{screen.height} ·{' '}
            {screen.isActive
              ? t('sections.screens.status.open')
              : t('sections.screens.status.closed')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={screen.isActive ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => toggleWindow(!screen.isActive)}
            disabled={busy}
            data-testid="screen-window-toggle"
            className="gap-1.5 whitespace-nowrap"
          >
            {screen.isActive ? <MonitorOff size={16} /> : <Monitor size={16} />}
            {screen.isActive
              ? t('sections.screens.window.close')
              : t('sections.screens.window.open')}
          </Button>
          <ActionMenu
            items={actions}
            label={t('sections.screens.actions.menu')}
            testId="screen-actions-menu"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* How it looks, large, with the way into its template */}
        <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          {template && (
            <TemplateThumbnail
              template={template}
              className="w-full shadow-sm"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              data-testid="screen-template-name"
              className="truncate text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {template ? templateDisplayName(template, t) : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
              title={t('sections.screens.actions.editTooltip')}
            >
              <Edit size={16} />
              <span className="ml-1">{t('sections.screens.actions.edit')}</span>
            </Button>
          </div>
        </div>

        <div className="space-y-5 min-w-0">
          <SettingsGroup
            title={t('sections.screens.groups.look')}
            testId="screen-group-look"
          >
            <ScreenTemplateSettings screen={screen} />
          </SettingsGroup>

          <SettingsGroup
            title={t('sections.screens.groups.idle')}
            testId="screen-group-idle"
          >
            <SwitchRow
              label={t('sections.screens.idle.clock.label')}
              description={t('sections.screens.idle.clock.description')}
              checked={emptySlide?.clockEnabled ?? false}
              onCheckedChange={toggleIdleClock}
              disabled={!emptySlide || updateContentConfig.isPending}
              testId="screen-idle-clock"
            />
            <SwitchRow
              label={t('sections.screens.closeOnEscape.label')}
              description={t('sections.screens.closeOnEscape.description')}
              checked={screen.closeOnEscape}
              onCheckedChange={(value) => save('closeOnEscape', value)}
              disabled={busy}
              testId="screen-close-on-escape"
            />
          </SettingsGroup>

          <SettingsGroup
            title={t('sections.screens.groups.where')}
            testId="screen-group-window"
          >
            <ScreenMonitorPicker screen={screen} />
            <SwitchRow
              label={t('sections.screens.openOnStartup.label')}
              description={t('sections.screens.openOnStartup.description')}
              checked={screen.openOnStartup}
              onCheckedChange={(value) => save('openOnStartup', value)}
              disabled={busy}
              testId="screen-open-on-startup"
            />
          </SettingsGroup>

          <details data-testid="screen-group-advanced" className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
              {t('sections.screens.groups.more')}
            </summary>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60 pl-5">
              <PreviewScreenRadio screen={screen} checked={isShownInPreviews} />
              <SwitchRow
                label={t('sections.screens.fullscreen.label')}
                description={t('sections.screens.fullscreen.description')}
                checked={screen.isFullscreen}
                onCheckedChange={(value) => save('isFullscreen', value)}
                disabled={busy}
                testId="screen-fullscreen"
              />
              <SwitchRow
                label={t('sections.screens.alwaysOnTop.label')}
                description={t('sections.screens.alwaysOnTop.description')}
                checked={screen.alwaysOnTop}
                onCheckedChange={(value) => save('alwaysOnTop', value)}
                disabled={busy}
                testId="screen-always-on-top"
              />
              <ScreenSceneTemplates screen={screen} />
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
