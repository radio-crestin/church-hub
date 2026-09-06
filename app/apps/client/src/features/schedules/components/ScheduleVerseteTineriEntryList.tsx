import { AlertTriangle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface ScheduleVerseteTineriEntryListProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item starts in the program's flat run. */
  itemStartFlatIndex: number
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
}

/**
 * The people-and-references of a Versete Tineri slide, one presentable row
 * each. Shared by the program page's item list and the Programe panel on the
 * song/Bible pages.
 */
export function ScheduleVerseteTineriEntryList({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onEntryClick,
}: ScheduleVerseteTineriEntryListProps) {
  const { t } = useTranslation('schedules')

  if (item.verseteTineriEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          {t('warnings.noEntries')}
        </span>
      </div>
    )
  }

  return (
    <>
      {item.verseteTineriEntries.map((entry, index) => {
        const isPresented =
          presentedInfo?.type === 'versete_tineri' &&
          presentedInfo.scheduleItemIndex === itemStartFlatIndex + index

        return (
          <button
            key={entry.id}
            ref={isPresented ? highlightedRef : null}
            type="button"
            data-testid={`schedule-sub-item-${itemStartFlatIndex + index}`}
            onClick={() => onEntryClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-inset ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User
                    size={12}
                    className={
                      isPresented
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400'
                    }
                  />
                  <span
                    className={`text-xs font-medium ${
                      isPresented
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {entry.personName}
                  </span>
                </div>
                <span
                  className={`text-xs flex items-center gap-1 ${
                    isPresented
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {entry.reference}
                  {!entry.text && (
                    <AlertTriangle
                      size={10}
                      className="text-amber-500 flex-shrink-0"
                      aria-label={t('warnings.invalidReference')}
                    />
                  )}
                </span>
                <span
                  className={`text-sm line-clamp-2 block ${
                    isPresented
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </>
  )
}
