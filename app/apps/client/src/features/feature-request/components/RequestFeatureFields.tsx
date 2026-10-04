import { useTranslation } from 'react-i18next'

import { saveEmail } from '../services/savedEmail'

export interface RequestFeatureValues {
  title: string
  notes: string
  email: string
}

interface RequestFeatureFieldsProps {
  values: RequestFeatureValues
  onChange: (values: RequestFeatureValues) => void
  disabled: boolean
}

const NOTES_MAX_LENGTH = 5000

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60'
const labelClass =
  'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

/** Title, notes and email. The email is remembered on this device on blur. */
export function RequestFeatureFields({
  values,
  onChange,
  disabled,
}: RequestFeatureFieldsProps) {
  const { t } = useTranslation()
  const update = (field: keyof RequestFeatureValues, value: string) =>
    onChange({ ...values, [field]: value })

  return (
    <>
      <div>
        <label htmlFor="feature-request-title" className={labelClass}>
          {t('common:featureRequest.titleLabel')}
        </label>
        <input
          id="feature-request-title"
          data-testid="feature-request-title"
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder={t('common:featureRequest.titlePlaceholder')}
          maxLength={120}
          required
          disabled={disabled}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="feature-request-notes" className={labelClass}>
          {t('common:featureRequest.notesLabel')}
        </label>
        <textarea
          id="feature-request-notes"
          data-testid="feature-request-notes"
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder={t('common:featureRequest.notesPlaceholder')}
          maxLength={NOTES_MAX_LENGTH}
          rows={5}
          required
          disabled={disabled}
          className={`${inputClass} resize-y`}
        />
        <p
          data-testid="feature-request-notes-counter"
          className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400"
        >
          {values.notes.length} / {NOTES_MAX_LENGTH}
        </p>
      </div>
      <div>
        <label htmlFor="feature-request-email" className={labelClass}>
          {t('common:featureRequest.emailLabel')}
        </label>
        <input
          id="feature-request-email"
          data-testid="feature-request-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          onBlur={(e) => saveEmail(e.target.value)}
          placeholder={t('common:featureRequest.emailPlaceholder')}
          required
          disabled={disabled}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('common:featureRequest.emailHint')}
        </p>
      </div>
    </>
  )
}
