import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import { QueueAddPlacement, type QueuePosition } from './QueueAddPlacement'
import { useLiveScheduleItemId } from '../../hooks/useLiveScheduleItemId'
import {
  ScheduleItemEditors,
  type ScheduleItemEditorsHandle,
} from '../ScheduleItemEditors'

export interface QueueAddEditorsHandle {
  /** Opens the add menu. */
  open: () => void
  /** Opens an item's editor. */
  edit: ScheduleItemEditorsHandle['editItem']
}

interface QueueAddEditorsProps {
  /** The queue, or the program running. */
  scheduleId: number
  title: string
}

/**
 * The control room's add menu: the presentations' own (songs, Bible verses,
 * music, gallery videos, programs, …), adding right after the step on the
 * screens, or at the end; and the same editors for the items it lists.
 */
export const QueueAddEditors = forwardRef<
  QueueAddEditorsHandle,
  QueueAddEditorsProps
>(function QueueAddEditors({ scheduleId, title }, ref) {
  const editorsRef = useRef<ScheduleItemEditorsHandle>(null)
  const [position, setPosition] = useState<QueuePosition>('afterLive')
  const liveItemId = useLiveScheduleItemId(scheduleId)
  const afterItemId =
    position === 'afterLive' && liveItemId !== null ? liveItemId : undefined

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setPosition('afterLive')
        editorsRef.current?.addItem()
      },
      edit: (item) => editorsRef.current?.editItem(item),
    }),
    [],
  )

  return (
    <ScheduleItemEditors
      ref={editorsRef}
      scheduleId={scheduleId}
      afterItemId={afterItemId}
      placement={
        <QueueAddPlacement
          title={title}
          canAddAfterLive={liveItemId !== null}
          position={position}
          onPositionChange={setPosition}
        />
      }
    />
  )
})
