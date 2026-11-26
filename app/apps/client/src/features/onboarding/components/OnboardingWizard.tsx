import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { Button } from '~/ui/button'
import { DoneStep } from './DoneStep'
import { FeaturesStep } from './FeaturesStep'
import { OnboardingProgress } from './OnboardingProgress'
import { WelcomeStep } from './WelcomeStep'
import { ONBOARDING_STEPS } from '../constants'
import { useFinishOnboarding } from '../hooks/useFinishOnboarding'
import { useVisibleFeatures } from '../hooks/useVisibleFeatures'

/**
 * The first-run onboarding: language and theme, the pages to keep in the
 * side menu, then a summary. Skip leaves everything as it is.
 */
export function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const [stepIndex, setStepIndex] = useState(0)
  const visible = useVisibleFeatures()
  const [chosen, setChosen] = useState<Set<BuiltInMenuItemId> | null>(null)
  const finish = useFinishOnboarding()

  const step = ONBOARDING_STEPS[stepIndex]
  const selected = chosen ?? visible ?? new Set<BuiltInMenuItemId>()
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1

  const toggle = (id: BuiltInMenuItemId) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  return (
    <div
      data-testid="onboarding"
      className="fixed inset-0 z-50 overflow-y-auto bg-app"
    >
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-8 p-4 py-10 sm:p-8">
        <OnboardingProgress step={step} />

        <div className="rounded-xl border border-line bg-panel p-6 sm:p-8">
          {step === 'welcome' && <WelcomeStep />}
          {step === 'features' && (
            <FeaturesStep selected={selected} onToggle={toggle} />
          )}
          {step === 'done' && <DoneStep selected={selected} />}
        </div>

        <div className="flex items-center justify-between gap-3">
          {isLast ? (
            <span />
          ) : (
            <Button
              variant="ghost"
              onClick={() => finish.mutate(null)}
              disabled={finish.isPending}
            >
              {t('skip')}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button
                variant="outline"
                onClick={() => setStepIndex(stepIndex - 1)}
                disabled={finish.isPending}
              >
                {t('back')}
              </Button>
            )}
            {isLast ? (
              <Button
                onClick={() => finish.mutate(selected)}
                disabled={finish.isPending}
              >
                {t('finish')}
              </Button>
            ) : (
              <Button
                onClick={() => setStepIndex(stepIndex + 1)}
                disabled={step === 'features' && !visible}
              >
                {t('next')}
              </Button>
            )}
          </div>
        </div>
        {finish.isError && (
          <p role="alert" className="text-center text-sm text-red-600">
            {t('saveError')}
          </p>
        )}
      </div>
    </div>
  )
}
