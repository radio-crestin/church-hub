import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Says plainly that the request becomes a public GitHub issue. */
export function PublicNotice() {
  const { t } = useTranslation()
  return (
    <div
      data-testid="feature-request-public-notice"
      className="flex gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200"
    >
      <Globe size={18} className="flex-shrink-0 mt-0.5" />
      <div>
        <strong className="block mb-0.5">
          {t('common:featureRequest.publicNoticeTitle')}
        </strong>
        {t('common:featureRequest.publicNoticeBody')}
      </div>
    </div>
  )
}
