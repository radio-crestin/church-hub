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
      className="fixed inset-0 m-auto w-[min(26rem,92vw)] rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
    >
      <form
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onSave(trimmed)
        }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('templates.rename.title')}
        </h2>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('templates.rename.label')}
          </span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
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
