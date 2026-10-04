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
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
        <CheckCircle2 size={28} />
      </div>
      <p className="text-base font-medium text-gray-900 dark:text-white mb-1">
        {t('common:featureRequest.successTitle')}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
        {t('common:featureRequest.successBody')}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          data-testid="feature-request-open-issue"
          onClick={() => void openExternalUrl(issueUrl)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg font-medium transition-colors"
        >
          <ExternalLink size={16} />
          {t('common:featureRequest.openIssue')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {t('common:buttons.ok')}
        </button>
      </div>
    </div>
  )
}
