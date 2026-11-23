import type { ReactNode } from 'react'

import { OnboardingWizard } from './OnboardingWizard'
import { useOnboardingPending } from '../hooks/useOnboardingPending'

interface OnboardingGateProps {
  children: ReactNode
}

/**
 * Shows the onboarding in place of the app until a new install has been
 * through it; installs that never had it, and users who can't change the
 * settings, go straight to the app.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { pending, isLoading } = useOnboardingPending()
  if (isLoading) return null
  if (pending) return <OnboardingWizard />
  return children
}
