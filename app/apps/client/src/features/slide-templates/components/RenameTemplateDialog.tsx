import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'

interface RenameTemplateDialogProps {
  /** The current name; null keeps the dialog closed. */
  name: string | null
  onSave: (name: string) => void
  onCancel: () => void
}

export function RenameTemplateDialog({
  name,
  onSave,
  onCancel,
}: RenameTemplateDialogProps) {
  const { t } = useTranslation('presentation')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (name !== null) {
      setValue(name)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [name])

  const trimmed = value.trim()

  return (
    <dialog
      ref={dialogRef}
      data-testid="rename-template-dialog"
      onClose={onCancel}
      className="fixed inset-0 m-auto w-[min(26rem,92vw)] rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
    >
      <form
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onSave(trimmed)
        }}
      >
        <h2 className="text-base font-semibold text-fg">
          {t('templates.rename.title')}
        </h2>
        <label className="block space-y-1">
          <span className="text-[13px] font-medium text-fg-label">
            {t('templates.rename.label')}
          </span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full h-9 px-3 text-[13px] bg-field border-0 rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common:buttons.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!trimmed}>
            {t('templates.rename.save')}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
