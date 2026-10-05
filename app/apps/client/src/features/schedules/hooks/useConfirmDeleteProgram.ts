import { useLocation, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  clearSectionLastVisited,
  getSchedulesLastVisited,
} from '~/features/navigation'
import { useToast } from '~/ui/toast'
import { useDeleteSchedule } from './useDeleteSchedule'
import type { Schedule } from '../types'

/**
 * Asks before deleting a program, then deletes it. Deleting the program that
 * is open leaves its page for the programs page, which opens another one.
 */
export function useConfirmDeleteProgram() {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const deleteSchedule = useDeleteSchedule()
  const [pending, setPending] = useState<Schedule | null>(null)

  async function confirmDelete() {
    if (!pending) return
    const deleted = await deleteSchedule.mutateAsync(pending.id)
    if (!deleted) {
      showToast(t('messages.error'), 'error')
      return
    }
    showToast(t('messages.deleted'), 'success')
    if (getSchedulesLastVisited()?.scheduleId === pending.id) {
      clearSectionLastVisited('schedules')
    }
    if (pathname === `/schedules/${pending.id}`) {
      navigate({ to: '/schedules' })
    }
    setPending(null)
  }

  return {
    pending,
    askToDelete: setPending,
    cancel: () => setPending(null),
    confirmDelete,
  }
}
