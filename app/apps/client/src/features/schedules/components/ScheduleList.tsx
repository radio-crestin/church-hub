import { CalendarDays, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScheduleCard } from './ScheduleCard'
import { useSchedules, useSearchSchedules } from '../hooks'
import type { Schedule, ScheduleSearchResult } from '../types'

interface ScheduleListProps {
  onScheduleClick: (scheduleId: number) => void
  onSaveClick?: (scheduleId: number) => void
  savingScheduleId?: number | null
}

export function ScheduleList({
  onScheduleClick,
  onSaveClick,
  savingScheduleId,
}: ScheduleListProps) {
  const { t } = useTranslation('schedules')
  const [searchQuery, setSearchQuery] = useState('')
  const { data: schedules, isLoading: schedulesLoading } = useSchedules()
  const { data: searchResults, isLoading: searchLoading } =
    useSearchSchedules(searchQuery)

  const isSearching = searchQuery.length > 0
  const isLoading = isSearching ? searchLoading : schedulesLoading

  const displaySchedules = useMemo(() => {
    if (isSearching && searchResults) {
      return searchResults.map((result: ScheduleSearchResult) => ({
        id: result.id,
        title: result.title,
        description: result.description,
        itemCount: result.itemCount,
        matchedContent: result.matchedContent,
      }))
    }
    return [...(schedules ?? [])]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((schedule: Schedule) => ({
        id: schedule.id,
        title: schedule.title,
        description: schedule.description,
        itemCount: schedule.itemCount,
        createdAt: schedule.createdAt,
      }))
  }, [isSearching, searchResults, schedules])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : displaySchedules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <CalendarDays
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {isSearching
              ? t('search.noResults', { query: searchQuery })
              : t('noSchedules')}
          </p>
          {!isSearching && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t('noSchedulesDescription')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {isSearching && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('search.resultsCount', { count: displaySchedules.length })}
            </p>
          )}
          {displaySchedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onSaveClick={onSaveClick}
              isSaving={savingScheduleId === schedule.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
