import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { takeServerChangedFlag } from '../utils/trackServerDatabase'

/** Read once per page load: the window reloaded because its server changed. */
const serverChangedOnLoad = takeServerChangedFlag()

/**
 * Says why the window just reloaded: another Church Hub took over its server,
 * so it now shows that app's songs (see `trackServerDatabase`).
 */
export function ServerChangedNotice() {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(serverChangedOnLoad)
  if (!visible) return null

  return (
    <div
      data-testid="server-changed-notice"
      role="alert"
      className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{t('serverChanged.title')}</p>
        <p className="mt-1">{t('serverChanged.description')}</p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={t('serverChanged.dismiss')}
        className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
