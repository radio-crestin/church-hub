import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface GuideStepProps {
  number: number
  title: string
  isDone?: boolean
  isOptional?: boolean
  children: ReactNode
}

/** One numbered step of the livestream setup guide, ticked once it is done. */
export function GuideStep({
  number,
  title,
  isDone = false,
  isOptional = false,
  children,
}: GuideStepProps) {
  const { t } = useTranslation('livestream')

  return (
    <li className="flex gap-3" data-testid={`livestream-guide-step-${number}`}>
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          isDone
            ? 'bg-green-600 text-white'
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        }`}
      >
        {isDone ? <Check className="h-4 w-4" aria-hidden /> : number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-white">
          {title}
          {isDone && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              {t('guide.done')}
            </span>
          )}
          {isOptional && !isDone && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {t('guide.optional')}
            </span>
          )}
        </h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          {children}
        </div>
      </div>
    </li>
  )
}
