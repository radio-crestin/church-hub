import { useTranslation } from 'react-i18next'

interface IncludeScreenshotToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Switch that decides whether the screenshot goes with the request. */
export function IncludeScreenshotToggle({
  checked,
  onChange,
}: IncludeScreenshotToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        id="feature-request-include-label"
        className="text-sm font-medium text-fg"
      >
        {t('common:featureRequest.includeScreenshot')}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="feature-request-include-label"
        data-testid="feature-request-include-screenshot"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-line-strong'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}
