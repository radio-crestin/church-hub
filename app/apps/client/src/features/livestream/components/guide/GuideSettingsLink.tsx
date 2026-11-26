import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

interface GuideSettingsLinkProps {
  to:
    | '/settings/livestream'
    | '/settings/midi'
    | '/settings/screens'
    | '/livestream/youtube'
    | '/livestream/obs'
    | '/livestream/mixer'
  label: string
  onNavigate: () => void
}

/** Opens the settings page a guide step talks about, closing the guide. */
export function GuideSettingsLink({
  to,
  label,
  onNavigate,
}: GuideSettingsLinkProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="inline-flex items-center gap-1 font-medium text-focus hover:underline"
    >
      {label}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
    </Link>
  )
}
