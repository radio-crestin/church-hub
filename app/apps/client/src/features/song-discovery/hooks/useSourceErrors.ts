import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useSongUpdates } from './useSongUpdates'

/**
 * Why the server's last check of each source failed, by source id, as the
 * user reads it: the HTTP status the download got ("Download failed: 403
 * Forbidden"), or the error itself.
 */
export function useSourceErrors(): Map<string, string> {
  const { t } = useTranslation('songDiscovery')
  const { state } = useSongUpdates()
  return useMemo(
    () =>
      new Map(
        (state?.sources ?? []).flatMap((update) =>
          update.error
            ? [
                [
                  update.sourceId,
                  update.httpStatus
                    ? t('source.downloadFailed', { status: update.httpStatus })
                    : t('source.checkFailed', { error: update.error }),
                ] as const,
              ]
            : [],
        ),
      ),
    [state?.sources, t],
  )
}
