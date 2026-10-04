import { Pencil, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DrawHintProps {
  hasDrawn: boolean
}

/** A friendly nudge to draw on the screenshot; it cheers once they have. */
export function DrawHint({ hasDrawn }: DrawHintProps) {
  const { t } = useTranslation()
  const Icon = hasDrawn ? Sparkles : Pencil
  return (
    <p
      data-testid="feature-request-draw-hint"
      className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-200"
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span>
        {hasDrawn
          ? t('common:featureRequest.drawHintDone')
          : t('common:featureRequest.drawHint')}
      </span>
    </p>
  )
}
