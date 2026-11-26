import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ONBOARDING_STEPS, type OnboardingStep } from '../constants'

interface OnboardingProgressProps {
  step: OnboardingStep
}

/** The onboarding's steps by title, with a bar of how far along it is. */
export function OnboardingProgress({ step }: OnboardingProgressProps) {
  const { t } = useTranslation('onboarding')
  const current = ONBOARDING_STEPS.indexOf(step)
  const percent = ((current + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <div className="space-y-3">
      <ol className="flex items-center gap-2 text-sm">
        {ONBOARDING_STEPS.map((name, index) => (
          <li
            key={name}
            data-state={
              index < current
                ? 'done'
                : index === current
                  ? 'active'
                  : 'pending'
            }
            className="flex items-center gap-2 text-fg-hint data-[state=active]:font-semibold data-[state=active]:text-fg data-[state=done]:text-fg-label"
          >
            {index > 0 && <span className="h-px w-6 bg-line" />}
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
              {index < current ? (
                <Check strokeWidth={1.75} className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className={index === current ? '' : 'hidden sm:inline'}>
              {t(`steps.${name}`)}
            </span>
          </li>
        ))}
      </ol>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={t('stepOf', {
          step: current + 1,
          total: ONBOARDING_STEPS.length,
        })}
        className="h-1.5 overflow-hidden rounded-full bg-field"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
