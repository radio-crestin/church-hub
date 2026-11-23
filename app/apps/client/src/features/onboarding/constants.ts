import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'

/** Set by the server on a new database; the onboarding clears it. */
export const ONBOARDING_PENDING_KEY = 'onboarding_pending'

export const ONBOARDING_QUERY_KEY = ['settings', ONBOARDING_PENDING_KEY]

/** The side-menu pages the onboarding offers, in menu order. */
export const ONBOARDING_FEATURES: BuiltInMenuItemId[] = [
  'present',
  'songs',
  'bible',
  'schedules',
  'gallery',
  'livestream',
  'music',
  'song_key',
  'live_translation',
  'feedback',
]

export const ONBOARDING_STEPS = ['welcome', 'features', 'done'] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
