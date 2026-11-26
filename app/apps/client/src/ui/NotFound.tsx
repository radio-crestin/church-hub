import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export default function NotFound({ children }: { children?: any }) {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-2 p-2">
      <div className="text-sm text-fg-label">
        {children || <p>{t('errors.pageNotFound')}</p>}
      </div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="inline-flex h-8 items-center px-3 bg-field hover:bg-hover text-fg rounded-lg text-sm font-medium transition-colors"
        >
          {t('buttons.goBack')}
        </button>
        <Link
          to="/present"
          className="inline-flex h-8 items-center px-3 bg-primary hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('buttons.startOver')}
        </Link>
      </p>
    </div>
  )
}
