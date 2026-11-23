import { useEffect, useState } from 'react'

import { Input } from '~/ui/input'
import { ConfirmModal } from '~/ui/modal'

interface NameModalProps {
  isOpen: boolean
  title: string
  message: string
  label: string
  confirmLabel: string
  initialName?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

/** Asks for a name: a new playlist's, or a playlist or folder renamed. */
export function NameModal({
  isOpen,
  title,
  message,
  label,
  confirmLabel,
  initialName = '',
  onConfirm,
  onCancel,
}: NameModalProps) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (isOpen) setName(initialName)
  }, [isOpen, initialName])

  const confirm = () => {
    if (name.trim()) onConfirm(name.trim())
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      onConfirm={confirm}
      onCancel={onCancel}
      isLoading={!name.trim()}
      testId="music-name-modal"
    >
      <Input
        value={name}
        aria-label={label}
        placeholder={label}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirm()
        }}
        autoFocus
      />
    </ConfirmModal>
  )
}
