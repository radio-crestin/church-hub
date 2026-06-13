import { useTranslation } from 'react-i18next'

import type { DiscoveryMatchVerdict } from '../types'

/**
 * Small pill describing how a candidate relates to the library. Only `similar`
 * and `new` ever reach the staging screen (exact duplicates are filtered out),
 * but the component handles every verdict for safety.
 */
export function VerdictBadge({ verdict }: { verdict: DiscoveryMatchVerdict }) {
  const { t } = useTranslation('songDiscovery')

  const styles: Record<DiscoveryMatchVerdict, string> = {
    new: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    similar:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'exact-title':
      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    'exact-filename':
      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[verdict]}`}
    >
      {t(`verdict.${verdict}`)}
    </span>
  )
}
