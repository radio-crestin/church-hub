import { useTranslation } from 'react-i18next'

import type { PcLink } from '../hooks/usePcLink'

/**
 * Where the songs come from now: live from the church computer (a green
 * dot), or the cloud while the computer is off or being looked for.
 */
export function PcLinkStatus({ link }: { link: PcLink }) {
  const { t } = useTranslation('publicApp')
  return (
    <p
      data-testid="pc-link"
      data-link={link}
      className="flex items-center gap-2 text-xs text-fg-hint"
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${link === 'live' ? 'bg-ok' : 'bg-fg-hint'}`}
      />
      {t(`link.${link}`)}
    </p>
  )
}
