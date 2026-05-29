import { ShieldCheck } from 'lucide-react'

interface UserAvatarProps {
  name: string
  isSuperAdmin?: boolean
  size?: 'sm' | 'md' | 'lg'
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

// Deterministic avatar gradient per account so users are easy to tell apart.
const AVATAR_GRADIENTS = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
]

function gradientFor(name: string, isSuperAdmin?: boolean): string {
  if (isSuperAdmin) return 'from-indigo-500 to-indigo-700'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

const SIZES = {
  sm: { box: 'h-8 w-8 text-xs', badge: 'h-3.5 w-3.5', icon: 'h-2.5 w-2.5' },
  md: { box: 'h-11 w-11 text-sm', badge: 'h-5 w-5', icon: 'h-3.5 w-3.5' },
  lg: { box: 'h-16 w-16 text-xl', badge: 'h-6 w-6', icon: 'h-4 w-4' },
} as const

/**
 * Colored, initials-based account avatar shared across the login screen, the
 * sidebar account button and the account page so a user looks the same
 * everywhere. Super admins get an indigo gradient and a shield badge.
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
      className={`relative flex ${s.box} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
        name,
        isSuperAdmin,
      )} font-semibold text-white shadow-sm`}
    >
      {getInitials(name)}
      {isSuperAdmin && showBadge && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex ${s.badge} items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-gray-800 dark:ring-gray-800`}
        >
          <ShieldCheck className={`${s.icon} text-indigo-500`} />
        </span>
      )}
    </span>
  )
}
