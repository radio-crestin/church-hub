import { CheckCircle2, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { openExternalUrl } from '../../livestream/utils/openInBrowser'

interface RequestFeatureSuccessProps {
  issueUrl: string
  onClose: () => void
}

/** Shown after the issue is created; the issue is also opened automatically. */
export function RequestFeatureSuccess({
  issueUrl,
  onClose,
}: RequestFeatureSuccessProps) {
  const { t } = useTranslation()
  return (
    <div
      data-testid="feature-request-success"
      className="flex flex-col items-center text-center py-6 px-4"
    >
      <div className="flex items-center justify-center text-ok mb-3">
        <CheckCircle2 strokeWidth={1.5} size={28} />
      </div>
      <p className="text-base font-medium text-fg mb-1">
        {t('common:featureRequest.successTitle')}
      </p>
      <p className="text-[13px] text-fg-label mb-4 max-w-sm">
        {t('common:featureRequest.successBody')}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          data-testid="feature-request-open-issue"
          onClick={() => void openExternalUrl(issueUrl)}
          className="flex items-center justify-center gap-1.5 h-9 px-3.5 text-[13px] bg-field text-fg hover:bg-hover rounded-lg font-medium transition-colors"
        >
          <ExternalLink strokeWidth={1.5} size={16} />
          {t('common:featureRequest.openIssue')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3.5 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {t('common:buttons.ok')}
        </button>
      </div>
    </div>
  )
}
