import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSchedulesLastVisited } from '~/features/navigation'
import { useSaveScheduleToFile } from '~/features/schedule-export'
import { useImportScheduleFromFile } from '~/features/schedule-import'
import { ScheduleList } from '~/features/schedules/components'
import { getScheduleById } from '~/features/schedules/service/schedules'
import { Button } from '~/ui/button'
import { ActionMenu } from '~/ui/menu'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { Page, PageHeader, PagePanel } from '~/ui/page'
import { useToast } from '~/ui/toast'

export const Route = createFileRoute('/schedules/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  const { t } = useTranslation('schedules')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { importSchedule, isPending: isImporting } = useImportScheduleFromFile()
  const { saveSchedule } = useSaveScheduleToFile()
  const [savingScheduleId, setSavingScheduleId] = useState<number | null>(null)
  const hasNavigatedOnOpen = useRef(false)

  // Auto-navigate to last visited schedule on initial page open
  useEffect(() => {
    if (hasNavigatedOnOpen.current) return

    const lastVisited = getSchedulesLastVisited()
    if (lastVisited?.scheduleId) {
      hasNavigatedOnOpen.current = true
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(lastVisited.scheduleId) },
      })
    }
  }, [navigate])

  const handleScheduleClick = (scheduleId: number) => {
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
    })
  }

  const handleSaveSchedule = async (scheduleId: number) => {
    setSavingScheduleId(scheduleId)
    try {
      const schedule = await getScheduleById(scheduleId)
      if (!schedule) {
        showToast(t('messages.error'), 'error')
        return
      }
      const result = await saveSchedule(schedule)
      if (result.success) {
        showToast(t('messages.savedToFile'), 'success')
      } else if (result.error) {
        showToast(result.error, 'error')
      }
    } catch {
      showToast(t('messages.error'), 'error')
    } finally {
      setSavingScheduleId(null)
    }
  }

  const handleImportSchedule = async () => {
    const result = await importSchedule()
    if (result.success && result.scheduleId) {
      const message = result.songsCreated
        ? t('messages.importedWithSongs', { count: result.songsCreated })
        : t('messages.imported')
      showToast(message, 'success')
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(result.scheduleId) },
      })
    } else if (result.error) {
      showToast(result.error, 'error')
    }
  }

  return (
    <PagePermissionGuard permission="programs.view">
      <Page>
        <PageHeader
          title={t('title')}
          actions={
            <>
              <Button
                onClick={() =>
                  navigate({
                    to: '/schedules/$scheduleId',
                    params: { scheduleId: 'new' },
                  })
                }
                title={t('actions.create')}
                aria-label={t('actions.create')}
                className="gap-2"
              >
                <Plus size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">{t('actions.create')}</span>
              </Button>
              <ActionMenu
                items={[
                  {
                    id: 'import-from-file',
                    label: t('actions.loadFromFile'),
                    description: t('actions.importFromFileDescription'),
                    icon: isImporting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Upload size={18} />
                    ),
                    iconClassName: 'text-fg-label',
                    onSelect: handleImportSchedule,
                    disabled: isImporting,
                    testId: 'schedules-import-from-file-action',
                  },
                ]}
                label={tCommon('actionsMenu.trigger')}
                testId="schedules-actions-menu"
              />
            </>
          }
        />
        <PagePanel>
          <ScheduleList
            onScheduleClick={handleScheduleClick}
            onSaveClick={handleSaveSchedule}
            savingScheduleId={savingScheduleId}
          />
        </PagePanel>
      </Page>
    </PagePermissionGuard>
  )
}
