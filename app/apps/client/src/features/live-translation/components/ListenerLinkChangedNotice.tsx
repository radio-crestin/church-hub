import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ListenerLinkChangedNoticeProps {
  onDismiss: () => void
}

/** Shown once after the update that gave the listener link a new address. */
export function ListenerLinkChangedNotice({
  onDismiss,
}: ListenerLinkChangedNoticeProps) {
  const { t } = useTranslation('liveTranslation')
  return (
    <div
      role="status"
      data-testid="listener-link-changed"
      className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-field rounded-lg"
    >
      <Info
        className="w-4 h-4 mt-0.5 shrink-0 text-fg-label"
        strokeWidth={1.5}
      />
      <p className="flex-1 text-sm text-fg-body">
        {t('dashboard.linkChanged')}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dashboard.dismissLinkChanged')}
        className="p-1 -m-1 rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}
