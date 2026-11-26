import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'default'
  /** Extra content under the message, e.g. the items the action applies to */
  children?: ReactNode
  testId?: string
  /** Disables the confirm button while the action runs */
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'default',
  children,
  testId,
  isLoading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation()
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

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primary hover:bg-indigo-700 text-white'

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid={testId}
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-5 min-w-[300px] max-w-md">
        <h2 className="text-base font-semibold text-fg mb-1.5">{title}</h2>
        <div className="mb-5 space-y-3">
          <p className="text-[13px] text-fg-label">{message}</p>
          {children}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {cancelLabel ?? t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`h-9 px-4 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
