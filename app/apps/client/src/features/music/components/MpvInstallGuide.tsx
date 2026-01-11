import { AlertCircle, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface MpvInstallGuideProps {
  installInstructions?: {
    mac: string
    windows: string
    linux: string
  }
}

export function MpvInstallGuide({ installInstructions }: MpvInstallGuideProps) {
  const { t } = useTranslation('music')

  if (!installInstructions) {
    return null
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {t('mpv.notInstalled')}
          </h4>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {t('mpv.installDescription')}
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {t('mpv.macOS')}:
              </span>
            </div>
            <code className="block bg-amber-100 dark:bg-amber-900/40 rounded px-2 py-1 text-xs font-mono text-amber-900 dark:text-amber-100">
              {installInstructions.mac}
            </code>

            <div className="flex items-center gap-2 mt-2">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {t('mpv.windows')}:
              </span>
            </div>
            <code className="block bg-amber-100 dark:bg-amber-900/40 rounded px-2 py-1 text-xs font-mono text-amber-900 dark:text-amber-100 break-all">
              {installInstructions.windows}
            </code>

            <div className="flex items-center gap-2 mt-2">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {t('mpv.linux')}:
              </span>
            </div>
            <code className="block bg-amber-100 dark:bg-amber-900/40 rounded px-2 py-1 text-xs font-mono text-amber-900 dark:text-amber-100 break-all">
              {installInstructions.linux}
            </code>
          </div>
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {t('mpv.restartAfterInstall')}
          </p>
        </div>
      </div>
    </div>
  )
}
