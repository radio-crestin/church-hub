import { Link } from '@tanstack/react-router'
import { ExternalLink, ListX, Loader2, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { ConfirmModal } from '~/ui/modal'
import { Tooltip } from '~/ui/tooltip/Tooltip'
import { QueueAddEditors, type QueueAddEditorsHandle } from './QueueAddEditors'
import { QueueItems } from './QueueItems'
import {
  useClearScheduleItems,
  useQueueSchedule,
  useRunningProgramId,
  useSchedule,
} from '../../hooks'
import { ScheduleRunButton } from '../ScheduleRunButton'

const SECONDARY_BUTTON =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-raised px-3 text-sm font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus'
const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus'

/**
 * The control room's left column: the queue the operator fills with Add and
 * walks with Previous / Next, or, while a program runs, that program, with
 * what is added going into it after its live item.
 */
export function ControlRoomQueue() {
  const { t } = useTranslation(['schedules', 'common'])
  const canEdit = usePermissions().hasPermission('programs.edit')
  const { data: queue, isLoading } = useQueueSchedule()
  const runningId = useRunningProgramId(queue?.id ?? null)
  const { data: running } = useSchedule(runningId ?? undefined)
  const clear = useClearScheduleItems()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const addRef = useRef<QueueAddEditorsHandle>(null)

  if (isLoading || !queue) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-fg-hint" />
      </div>
    )
  }

  const program = runningId !== null && running ? running : null
  const target = program
    ? { id: program.id, title: program.title }
    : { id: queue.id, title: t('queue.title') }
  const isEmptyQueue = !program && queue.items.length === 0
  const openAdd = () => addRef.current?.open()

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="control-room-queue"
      data-showing={program ? 'program' : 'queue'}
      data-schedule-id={target.id}
    >
      <div className="flex items-center justify-between gap-2 pl-2">
        <h2
          className="min-w-0 truncate text-sm font-medium text-fg"
          data-testid="control-room-queue-title"
        >
          {target.title}
        </h2>
        <div className="flex items-center gap-1">
          {program && (
            <>
              <ScheduleRunButton scheduleId={program.id} compact />
              <Link
                to="/schedules/$scheduleId"
                params={{ scheduleId: String(program.id) }}
                aria-label={t('queue.open')}
                title={t('queue.open')}
                className={ICON_BUTTON}
              >
                <ExternalLink size={16} strokeWidth={1.5} />
              </Link>
            </>
          )}
          {canEdit && !program && queue.items.length > 0 && (
            <Tooltip content={t('queue.clear')} position="bottom">
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                aria-label={t('queue.clear')}
                data-testid="queue-clear"
                className={ICON_BUTTON}
              >
                <ListX size={16} strokeWidth={1.5} />
              </button>
            </Tooltip>
          )}
          {canEdit && !isEmptyQueue && (
            <Tooltip content={t('queue.addHint')} position="bottom">
              <button
                type="button"
                onClick={openAdd}
                aria-label={t('queue.addHint')}
                data-testid="queue-add"
                className={SECONDARY_BUTTON}
              >
                <Plus size={16} strokeWidth={1.5} />
                <span>{t('common:addMenu.button')}</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {isEmptyQueue ? (
        <div
          data-testid="queue-empty"
          className="flex flex-col items-center gap-2 px-6 py-12 text-center"
        >
          <p className="text-sm font-medium text-fg">{t('queue.empty')}</p>
          <p className="max-w-xs text-sm text-fg-hint">
            {t('queue.emptyHint')}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              data-testid="queue-add"
              className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <Plus size={16} strokeWidth={1.5} />
              {t('common:addMenu.button')}
            </button>
          )}
        </div>
      ) : (
        <QueueItems
          key={target.id}
          scheduleId={target.id}
          onEditItem={
            !program && canEdit
              ? (item) => addRef.current?.edit(item)
              : undefined
          }
        />
      )}

      {canEdit && (
        <QueueAddEditors
          ref={addRef}
          scheduleId={target.id}
          title={target.title}
        />
      )}

      <ConfirmModal
        isOpen={confirmingClear}
        title={t('queue.clearTitle')}
        message={t('queue.clearMessage')}
        confirmLabel={t('queue.clearConfirm')}
        variant="danger"
        isLoading={clear.isPending}
        testId="queue-clear-confirm"
        onCancel={() => setConfirmingClear(false)}
        onConfirm={() =>
          clear.mutate(queue.id, { onSettled: () => setConfirmingClear(false) })
        }
      />
    </div>
  )
}
