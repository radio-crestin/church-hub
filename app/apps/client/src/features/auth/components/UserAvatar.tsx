import { ShieldCheck } from 'lucide-react'

interface UserAvatarProps {
  name: string
  isSuperAdmin?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Show the super-admin shield badge (hidden on very small avatars by default). */
  showBadge?: boolean
}

/** First letters of up to two name words, e.g. "John Doe" → "JD". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic flat avatar colour per account so users are easy to tell
// apart (DESIGN.md allows colour here: it identifies a person).
const AVATAR_COLORS = [
  'bg-rose-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-teal-600',
  'bg-pink-600',
]

function colorFor(name: string, isSuperAdmin?: boolean): string {
  if (isSuperAdmin) return 'bg-primary'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const SIZES = {
  xs: { box: 'h-5 w-5 text-[9px]', badge: 'hidden', icon: 'h-2 w-2' },
  sm: { box: 'h-8 w-8 text-xs', badge: 'h-3.5 w-3.5', icon: 'h-2.5 w-2.5' },
  md: { box: 'h-11 w-11 text-sm', badge: 'h-5 w-5', icon: 'h-3.5 w-3.5' },
  lg: { box: 'h-16 w-16 text-xl', badge: 'h-6 w-6', icon: 'h-4 w-4' },
} as const

/**
 * Coloured, initials-based account avatar shared across the login screen, the
 * sidebar account button and the account page so a user looks the same
 * everywhere. Super admins get the primary colour and a shield badge.
 */
export function UserAvatar({
  name,
  isSuperAdmin,
  size = 'md',
  showBadge = true,
}: UserAvatarProps) {
  const s = SIZES[size]
  return (
    <span
      className={`relative flex ${s.box} shrink-0 items-center justify-center rounded-full ${colorFor(
        name,
        isSuperAdmin,
      )} font-semibold text-white`}
    >
      {getInitials(name)}
      {isSuperAdmin && showBadge && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex ${s.badge} items-center justify-center rounded-full bg-panel ring-2 ring-panel`}
        >
          <ShieldCheck strokeWidth={2} className={`${s.icon} text-fg-label`} />
        </span>
      )}
    </span>
  )
}
