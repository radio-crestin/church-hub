import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { ActionMenu, type ActionMenuItem } from './ActionMenu'
import { countFittingActions } from './countFittingActions'
import { measureContentWidth } from './measureContentWidth'

/** A header action: an inline control while it fits, a menu row once it does not. */
export interface OverflowAction extends ActionMenuItem {
  /** The control shown in the row — normally a small coloured icon button. */
  inline: React.ReactNode
}

interface OverflowActionsProps {
  /** The title side of the row: chevron, icon, title, count. */
  leading: React.ReactNode
  actions: OverflowAction[]
  /** Test id of the "More" trigger; its menu is `${testId}-panel`. */
  testId?: string
}

/**
 * How far the first action may cut the title: enough for the chevron, the
 * panel icon and the first few letters. Past it, that action moves into
 * "More" too. Only the trigger itself may still squeeze the title below it,
 * because an unreachable menu would be worse than a short title.
 */
const LEADING_MIN_WIDTH = 88

/**
 * A panel header row whose actions gather under a "More" (⋮) menu as the
 * column narrows — rightmost first — and come back out as it widens.
 *
 * The title and its count are what tell the operator which panel this is and
 * how full it is, so they stay whole for as long as any action but the first
 * is still in the row: those leave for "More" before the title is cut. The
 * first action is the panel's main one ("+"), and only it may trim the title,
 * down to `LEADING_MIN_WIDTH`, to stay in the row.
 *
 * Actions that do not fit stay mounted but hidden, so anything they own
 * (state, refs) survives the trip into the menu. Each action's width is
 * remembered from the last time it was on screen, because a hidden one cannot
 * be measured; that is what lets the row decide without rendering twice.
 */
export function OverflowActions({
  leading,
  actions,
  testId,
}: OverflowActionsProps) {
  const { t } = useTranslation('common')
  const rowRef = useRef<HTMLDivElement>(null)
  const leadingRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const actionElements = useRef(new Map<string, HTMLDivElement>())
  const actionWidths = useRef(new Map<string, number>())
  const moreWidth = useRef<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(actions.length)
  // The resize observer outlives renders; this hands it the current measure.
  const measureRef = useRef<() => void>(() => {})

  // Runs after every render, before paint: a changed action list or a new
  // measurement settles here without the operator ever seeing the in-between.
  useLayoutEffect(() => {
    const measure = () => {
      const row = rowRef.current
      const leadingRow = leadingRef.current
      const actionsRow = actionsRef.current
      if (!row || !leadingRow || !actionsRow) return

      const rowWidth = row.getBoundingClientRect().width
      // A hidden ancestor (a panel the screen is too narrow for) leaves
      // nothing to fit into; keep the last answer until it shows again.
      if (rowWidth === 0) return

      for (const [id, element] of actionElements.current) {
        const width = element.getBoundingClientRect().width
        if (width > 0) actionWidths.current.set(id, width)
      }
      const triggerWidth = moreRef.current?.getBoundingClientRect().width
      if (triggerWidth) moreWidth.current = triggerWidth

      // An action added while it would be hidden has never been measured.
      // Show everything for one pass; this effect runs again before paint.
      const unmeasured = actions.some(
        (action, index) =>
          index >= visibleCount && !actionWidths.current.has(action.id),
      )
      if (unmeasured) {
        setVisibleCount(actions.length)
        return
      }

      const widths = actions.map(
        (action) => actionWidths.current.get(action.id) ?? 0,
      )
      const rowGap = Number.parseFloat(getComputedStyle(row).columnGap)
      const fitBeside = (leadingWidth: number) =>
        countFittingActions({
          actionWidths: widths,
          // Before the trigger's first appearance, assume it is as wide as the
          // header buttons it sits among; it is re-measured once it shows.
          moreWidth: moreWidth.current ?? Math.max(0, ...widths),
          available: rowWidth - leadingWidth - rowGap,
          gap: Number.parseFloat(getComputedStyle(actionsRow).columnGap),
        })
      // Beside the whole title first; the first action alone may then cut it.
      const wholeTitle = Math.max(
        measureContentWidth(leadingRow),
        LEADING_MIN_WIDTH,
      )
      setVisibleCount(
        Math.max(
          fitBeside(wholeTitle),
          Math.min(1, fitBeside(LEADING_MIN_WIDTH)),
        ),
      )
    }

    measureRef.current = measure
    measure()
  })

  // The row's width is set by the column, never by what it holds, so
  // re-fitting on resize cannot feed back into another resize. flushSync puts
  // the new split on screen in the same frame the column changed.
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const observer = new ResizeObserver(() => {
      flushSync(() => measureRef.current())
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  const overflowItems: ActionMenuItem[] = actions
    .slice(visibleCount)
    .map(({ inline: _inline, ...item }) => item)

  return (
    <div ref={rowRef} className="flex min-w-0 flex-1 items-center gap-2">
      <div ref={leadingRef} className="flex min-w-0 flex-1 items-center gap-2">
        {leading}
      </div>
      <div ref={actionsRef} className="flex shrink-0 items-center gap-1">
        {actions.map((action, index) => (
          <div
            key={action.id}
            ref={(element) => {
              if (element) actionElements.current.set(action.id, element)
              else actionElements.current.delete(action.id)
            }}
            className={index < visibleCount ? 'flex' : 'hidden'}
          >
            {action.inline}
          </div>
        ))}
        {overflowItems.length > 0 && (
          <div ref={moreRef} className="flex">
            <ActionMenu
              items={overflowItems}
              label={t('actionsMenu.trigger')}
              testId={testId}
              size="compact"
            />
          </div>
        )}
      </div>
    </div>
  )
}
