import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useSongDiscovery } from '../context/SongDiscoveryContext'

/**
 * The exact lucide "sparkles" icon (same one in the discovery screen header) as
 * a CSS mask, so the animated gradient behind it shows through the icon shape —
 * giving the icon the same moving gradient as the button border.
 */
const SPARKLES_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'/%3E%3Cpath d='M20 3v4'/%3E%3Cpath d='M22 5h-4'/%3E%3Cpath d='M4 17v2'/%3E%3Cpath d='M5 18H3'/%3E%3C/svg%3E\") center / contain no-repeat"

/**
 * Header entry point to the discovery screen. The border and the star share one
 * animated gradient (it drifts faster while the background catalog check runs).
 */
export function DiscoverButton() {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { isChecking } = useSongDiscovery()

  const gradient = `discover-gradient${isChecking ? ' discover-gradient-active' : ''}`

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/songs/discover' })}
      title={isChecking ? t('button.searching') : t('button.discover')}
      className={`group relative mt-1 inline-flex shrink-0 rounded-lg p-[1.5px] shadow-sm transition-transform hover:scale-[1.03] ${gradient}`}
    >
      <span className="flex items-center gap-2 whitespace-nowrap rounded-[6.5px] bg-white px-5 py-1.5 text-sm font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <span
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 ${gradient}`}
          style={{ WebkitMask: SPARKLES_MASK, mask: SPARKLES_MASK }}
        />
        <span className="whitespace-nowrap">
          {isChecking ? t('button.searching') : t('button.discover')}
          {isChecking && (
            <span className="discover-dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
