import { useTranslation } from 'react-i18next'

import { saveEmail } from '../services/savedEmail'
import { inputClass, labelClass } from '../utils/fieldClasses'

interface EmailFieldProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

/** The reply address; private, and remembered on this device on blur. */
export function EmailField({ value, onChange, disabled }: EmailFieldProps) {
  const { t } = useTranslation()
  return (
    <div>
      <label htmlFor="feature-request-email" className={labelClass}>
        {t('common:featureRequest.emailLabel')}
      </label>
      <input
        id="feature-request-email"
        data-testid="feature-request-email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => saveEmail(event.target.value)}
        placeholder={t('common:featureRequest.emailPlaceholder')}
        required
        disabled={disabled}
        className={inputClass}
      />
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t('common:featureRequest.emailHint')}
      </p>
    </div>
  )
}
