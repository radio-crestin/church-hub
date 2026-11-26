import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { librarySubmissionsQueryKey } from './useLibrarySubmissions'
import { decideLibrarySubmission } from '../service/songLibrary'
import type { CuratorDecision } from '../types'

/** Approves, merges or rejects a submission, then reloads the queue. */
export function useDecideSubmission() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { t } = useTranslation('songLibrary')

  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: CuratorDecision }) =>
      decideLibrarySubmission(id, decision),
    onSuccess: (_result, { decision }) => {
      queryClient.invalidateQueries({ queryKey: librarySubmissionsQueryKey })
      showToast(t(`curator.decided.${decision.decision}`), 'success')
    },
    onError: () => showToast(t('curator.decisionFailed'), 'error'),
  })
}
