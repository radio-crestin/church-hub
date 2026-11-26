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
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-field text-xs font-medium tabular-nums ${
          isDone ? 'text-ok' : 'text-fg-label'
        }`}
      >
        {isDone ? <Check size={14} strokeWidth={1.75} aria-hidden /> : number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-fg">
          {title}
          {isDone && (
            <span className="text-xs font-normal text-ok">
              {t('guide.done')}
            </span>
          )}
          {isOptional && !isDone && (
            <span className="text-xs font-normal text-fg-hint">
              {t('guide.optional')}
            </span>
          )}
        </h3>
        <div className="space-y-2 text-[13px] text-fg-label">{children}</div>
      </div>
    </li>
  )
}
