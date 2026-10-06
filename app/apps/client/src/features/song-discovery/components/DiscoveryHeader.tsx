import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'
import { Button } from '~/ui/button'
import { PageHeader } from '~/ui/page'

interface DiscoveryHeaderProps {
  onBack?: () => void
  selectedCount: number
  totalCount: number
  onImport: () => void
  isImporting: boolean
  isChecking: boolean
  /** When the sources were last checked for new songs. */
  checkedAt: number | null
  onCheckAgain: () => void
}

/** The page's header: back, title, then "import" (primary) and "check again". */
export function DiscoveryHeader({
  onBack,
  selectedCount,
  totalCount,
  onImport,
  isImporting,
  isChecking,
  checkedAt,
  onCheckAgain,
}: DiscoveryHeaderProps) {
  const { t, i18n } = useTranslation('songDiscovery')

  const description = isChecking
    ? t('source.checkingAll')
    : checkedAt
      ? t('source.lastChecked', {
          when: formatRelativeTime(checkedAt, i18n.language),
        })
      : t('page.description')

  return (
    <div className="flex items-center gap-2">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <PageHeader
          title={t('page.title')}
          description={description}
          actions={
            <>
              <Button
                variant="primary"
                onClick={onImport}
                disabled={selectedCount === 0 || isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {selectedCount === totalCount
                  ? t('toolbar.importAll', { count: selectedCount })
                  : t('toolbar.importSelected', { count: selectedCount })}
              </Button>
              <Button
                variant="secondary"
                onClick={onCheckAgain}
                disabled={isChecking}
                title={t('source.checkAll')}
                aria-label={t('source.checkAll')}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">{t('source.checkAll')}</span>
              </Button>
            </>
          }
        />
      </div>
    </div>
  )
}
