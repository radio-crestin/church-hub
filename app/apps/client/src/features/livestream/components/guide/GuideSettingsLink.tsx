import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

interface GuideSettingsLinkProps {
  to: '/settings/livestream' | '/settings/midi' | '/settings/screens'
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
      className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
