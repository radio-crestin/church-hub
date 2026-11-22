import {
  ChevronRight,
  Copy,
  CopyPlus,
  Edit,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast/useToast'
import { ScreenIdlePreview } from './ScreenIdlePreview'
import { ScreenMonitorPicker } from './ScreenMonitorPicker'
import {
  useScreen,
  useUpdateScreenContentConfig,
  useUpsertScreen,
} from '../../hooks'
import type { ContentType, Screen, ScreenType } from '../../types'
import {
  closeDisplayWindow,
  openDisplayWindow,
  setDisplayAlwaysOnTop,
} from '../../utils/openDisplayWindow'

const SCREEN_TYPE_COLORS: Record<ScreenType, string> = {
  primary: 'bg-blue-600',
  stage: 'bg-purple-600',
  livestream: 'bg-green-600',
  kiosk: 'bg-orange-600',
}

/**
 * The per-screen switches saved straight from the card, each with the i18n
 * group (`sections.screens.<group>`) holding its toasts.
 */
const SWITCH_MESSAGES = {
  openOnStartup: 'openOnStartup',
  isFullscreen: 'fullscreen',
  alwaysOnTop: 'alwaysOnTop',
  closeOnEscape: 'closeOnEscape',
  isPreviewScreen: 'previewScreen',
} as const

type ScreenSwitch = keyof typeof SWITCH_MESSAGES

interface ScreenCardProps {
  screen: Screen
  onEdit: (contentType?: ContentType) => void
  onExport: () => void
  onCopyUrl: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDuplicating: boolean
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
 * One screen in Settings → Screens: what it is, what the projector shows
 * when nothing is live, and its window switches, each saying what it does.
 */
export function ScreenCard({
  screen,
  onEdit,
  onExport,
  onCopyUrl,
  onDuplicate,
  onDelete,
  isDuplicating,
}: ScreenCardProps) {
  const { t } = useTranslation(['settings', 'presentation'])
  const { showToast } = useToast()
  const upsertScreen = useUpsertScreen()
  const updateContentConfig = useUpdateScreenContentConfig()
  const { data: screenWithConfigs } = useScreen(screen.id)
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

  return (
    <div
      data-testid="screen-card"
      data-screen-id={screen.id}
      className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* Identity: status, name, type, size, and the screen's actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              screen.isActive ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {screen.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full text-white ${SCREEN_TYPE_COLORS[screen.type]}`}
              >
                {t(`presentation:screens.screenTypes.${screen.type}`)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {screen.width}×{screen.height}
              </span>
              <span
                data-testid="screen-window-status"
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                ·{' '}
                {screen.isActive
                  ? t('sections.screens.status.open')
                  : t('sections.screens.status.closed')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
          <Button
            className="basis-full sm:basis-auto justify-center whitespace-nowrap"
            variant="secondary"
            size="sm"
            onClick={() => onEdit()}
            title={t('sections.screens.actions.editTooltip')}
          >
            <Edit size={16} />
            <span className="ml-1">{t('sections.screens.actions.edit')}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            title={t('sections.screens.export.title')}
            aria-label={t('sections.screens.export.title')}
          >
            <ExternalLink size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyUrl}
            title={t('sections.screens.actions.copyUrl')}
            aria-label={t('sections.screens.actions.copyUrl')}
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="screen-duplicate"
            onClick={onDuplicate}
            disabled={isDuplicating}
            title={t('sections.screens.actions.duplicate')}
            aria-label={t('sections.screens.actions.duplicate')}
          >
            <CopyPlus size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            title={t('sections.screens.actions.delete')}
            aria-label={t('sections.screens.actions.delete')}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 lg:grid-cols-2">
        {/* What the projector shows between items */}
        <SettingsGroup
          title={t('sections.screens.groups.idle')}
          testId="screen-group-idle"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-2">
            <ScreenIdlePreview
              screen={screenWithConfigs}
              onClick={() => onEdit('empty')}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {screen.closeOnEscape
                ? t('sections.screens.idle.summaryClosed')
                : t('sections.screens.idle.summaryOpen')}
            </p>
          </div>
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

        {/* The window on the projector */}
        <SettingsGroup
          title={t('sections.screens.groups.window')}
          testId="screen-group-window"
        >
          <SwitchRow
            label={t('sections.screens.window.label')}
            description={t('sections.screens.window.description')}
            checked={screen.isActive}
            onCheckedChange={toggleWindow}
            disabled={busy}
            testId="screen-window-open"
          />
          <SwitchRow
            label={t('sections.screens.openOnStartup.label')}
            description={t('sections.screens.openOnStartup.description')}
            checked={screen.openOnStartup}
            onCheckedChange={(value) => save('openOnStartup', value)}
            disabled={busy}
            testId="screen-open-on-startup"
          />
          <ScreenMonitorPicker screen={screen} />
          <SwitchRow
            label={t('sections.screens.previewScreen.label')}
            description={t('sections.screens.previewScreen.description')}
            checked={screen.isPreviewScreen}
            onCheckedChange={(value) => save('isPreviewScreen', value)}
            disabled={busy}
            testId="screen-preview-screen"
          />
          <details data-testid="screen-group-advanced" className="group py-2">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
              {t('sections.screens.groups.advanced')}
            </summary>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60 pl-5">
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
            </div>
          </details>
        </SettingsGroup>
      </div>
    </div>
  )
}
