import { useEffect, useRef } from 'react'

import type { NotificationOptions } from './types'
import { useNotifications } from './useNotifications'

type BannerOptions = Omit<NotificationOptions, 'id' | 'persistent'> & {
  id: string
}

/**
 * A status banner that shows while `condition` holds and goes away when it
 * stops (e.g. "connection lost"). Updates in place when its text changes.
 */
export function useNotificationWhile(
  condition: boolean,
  options: BannerOptions,
) {
  const { notify, dismiss } = useNotifications()
  const optionsRef = useRef(options)
  optionsRef.current = options
  const { id, kind, title, message, dismissible } = options
  const actionLabel = options.action?.label

  useEffect(() => {
    if (!condition) return
    const { action } = optionsRef.current
    notify({
      id,
      kind,
      title,
      message,
      dismissible,
      persistent: true,
      action: action && {
        label: action.label,
        onClick: () => optionsRef.current.action?.onClick(),
      },
    })
    return () => dismiss(id)
  }, [
    condition,
    id,
    kind,
    title,
    message,
    dismissible,
    actionLabel,
    notify,
    dismiss,
  ])
}
