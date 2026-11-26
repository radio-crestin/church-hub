import { Mail, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/**
 * Direct-contact modal: email + WhatsApp shortcuts. Opened from the
 * Feedback modal's bottom-left "Contact us" button, so it stacks on top
 * of the feedback dialog — closing it returns the user to the form
 * with their typed message intact.
 */
export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  const getWhatsAppUrl = () => {
    const greeting =
      i18n.language === 'ro' ? 'Buna ziua [ChurchHub],' : 'Hello [ChurchHub],'
    return `https://api.whatsapp.com/send/?phone=40766338046&text=${encodeURIComponent(greeting)}`
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-sm w-full"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg">
            {t('common:contact.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-fg-hint hover:text-fg-body rounded-lg transition-colors"
            aria-label={t('common:buttons.cancel')}
          >
            <X strokeWidth={1.5} size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:iosif@radiocrestin.ro"
            className="flex items-center gap-3 p-3 rounded-lg bg-field hover:bg-hover transition-colors group"
          >
            <div className="w-8 h-8 flex items-center justify-center text-fg-label">
              <Mail strokeWidth={1.5} size={16} />
            </div>
            <div>
              <p className="text-xs text-fg-hint">
                {t('common:contact.email')}
              </p>
              <p className="text-[13px] text-fg">iosif@radiocrestin.ro</p>
            </div>
          </a>

          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-field hover:bg-hover transition-colors group"
          >
            <div className="w-8 h-8 flex items-center justify-center text-fg-label">
              <WhatsAppIcon size={16} />
            </div>
            <div>
              <p className="text-xs text-fg-hint">
                {t('common:contact.whatsapp')}
              </p>
              <p className="text-[13px] text-fg">+40 766 338 046</p>
            </div>
          </a>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('common:buttons.ok')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
