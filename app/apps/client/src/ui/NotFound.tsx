import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export default function NotFound({ children }: { children?: any }) {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-2 p-2">
      <div className="text-gray-600 dark:text-gray-400">
        {children || <p>{t('errors.pageNotFound')}</p>}
      </div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="bg-emerald-500 dark:bg-emerald-700 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm transition-colors"
        >
          {t('buttons.goBack')}
        </button>
        <Link
          to="/present"
          className="bg-cyan-600 dark:bg-cyan-700 hover:bg-cyan-700 dark:hover:bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm transition-colors"
        >
          {t('buttons.startOver')}
        </Link>
      </p>
    </div>
  )
}
