import { useQuery } from '@tanstack/react-query'

import { usePermissions } from '~/provider/permissions-provider'
import { getSetting } from '~/service/settings'
import { ONBOARDING_PENDING_KEY, ONBOARDING_QUERY_KEY } from '../constants'

/**
 * Whether this install still waits for its onboarding. Only someone who may
 * edit the settings goes through it; everyone else gets the app as it is.
 */
export function useOnboardingPending() {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('settings.edit')

  const query = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: async () =>
      (await getSetting('app_settings', ONBOARDING_PENDING_KEY))?.value ===
      'true',
    enabled: canEdit,
    staleTime: Number.POSITIVE_INFINITY,
  })

  return {
    pending: canEdit && query.data === true,
    isLoading: canEdit && query.isLoading,
  }
}
