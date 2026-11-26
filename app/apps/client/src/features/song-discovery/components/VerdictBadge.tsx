import { useTranslation } from 'react-i18next'

import type { DiscoveryMatchVerdict } from '../types'

/**
 * Small label describing how a candidate relates to the library. Only `similar`
 * and `new` ever reach the staging screen (exact duplicates are filtered out),
 * but the component handles every verdict for safety.
 */
export function VerdictBadge({ verdict }: { verdict: DiscoveryMatchVerdict }) {
  const { t } = useTranslation('songDiscovery')

  const styles: Record<DiscoveryMatchVerdict, string> = {
    new: 'text-fg',
    similar: 'text-fg-label',
    'exact-source': 'text-fg-hint',
    'exact-lyrics': 'text-fg-hint',
    'exact-title': 'text-fg-hint',
    'exact-filename': 'text-fg-hint',
  }

  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${styles[verdict]}`}
    >
      {t(`verdict.${verdict}`)}
    </span>
  )
}
