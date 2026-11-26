import { useTranslation } from 'react-i18next'

import type { PcLink } from '../hooks/usePcLink'

interface PcLinkStatusProps {
  link: PcLink
  /** The PC's events reach the phone (its WebSocket is open). */
  listening: boolean
}

/**
 * Where the songs come from now: live from the church computer (a green
 * dot), or the cloud while the computer is off or being looked for.
 */
export function PcLinkStatus({ link, listening }: PcLinkStatusProps) {
  const { t } = useTranslation('publicApp')
  return (
    <p
      data-testid="pc-link"
      data-link={link}
      data-listening={listening}
      aria-live="polite"
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
