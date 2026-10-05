import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** One plain line: the request becomes a public GitHub issue. */
export function PublicNotice() {
  const { t } = useTranslation()
  return (
    <p
      data-testid="feature-request-public-notice"
      className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300"
    >
      <Globe size={14} className="flex-shrink-0 mt-px" />
      {t('common:featureRequest.publicNotice')}
    </p>
  )
}
