import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { inputClass, labelClass } from '../utils/fieldClasses'

export const NOTES_MAX_LENGTH = 5000

interface NotesFieldProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
  ref?: Ref<HTMLTextAreaElement>
}

/** What the user would like, in their words. Optional. */
export function NotesField({
  value,
  onChange,
  disabled,
  ref,
}: NotesFieldProps) {
  const { t } = useTranslation()
  return (
    <div>
      <label htmlFor="feature-request-notes" className={labelClass}>
        {t('common:featureRequest.notesLabel')}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          {` ${t('common:featureRequest.optional')}`}
        </span>
      </label>
      <textarea
        ref={ref}
        id="feature-request-notes"
        data-testid="feature-request-notes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('common:featureRequest.notesPlaceholder')}
        maxLength={NOTES_MAX_LENGTH}
        rows={3}
        disabled={disabled}
        className={`${inputClass} resize-y`}
      />
      <p
        data-testid="feature-request-notes-counter"
        className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400"
      >
        {value.length} / {NOTES_MAX_LENGTH}
      </p>
    </div>
  )
}
