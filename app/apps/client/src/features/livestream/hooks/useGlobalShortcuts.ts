import {
  register,
  unregister,
  unregisterAll,
} from '@tauri-apps/plugin-global-shortcut'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '../../../utils/logger'
import type { SceneShortcut } from '../types'

const logger = createLogger('livestream:global-shortcuts')

interface UseGlobalShortcutsOptions {
  onShortcutTriggered: (sceneName: string) => void
}

export function useGlobalShortcuts({
  onShortcutTriggered,
}: UseGlobalShortcutsOptions) {
  const [registeredShortcuts, setRegisteredShortcuts] = useState<
    SceneShortcut[]
  >([])
  const [isRegistering, setIsRegistering] = useState(false)
  const onShortcutTriggeredRef = useRef(onShortcutTriggered)

  useEffect(() => {
    onShortcutTriggeredRef.current = onShortcutTriggered
  }, [onShortcutTriggered])

  const registerShortcuts = useCallback(
    async (shortcuts: SceneShortcut[]) => {
      if (isRegistering) return
      setIsRegistering(true)

      try {
        await unregisterAll()

        const successfullyRegistered: SceneShortcut[] = []

        for (const { shortcut, sceneName } of shortcuts) {
          if (!shortcut) continue

          try {
            await register(shortcut, (event) => {
              if (event.state === 'Pressed') {
                onShortcutTriggeredRef.current(sceneName)
              }
            })
            successfullyRegistered.push({ shortcut, sceneName })
          } catch (error) {
            logger.error(`Failed to register shortcut ${shortcut}:`, error)
          }
        }

        setRegisteredShortcuts(successfullyRegistered)
      } catch (error) {
        logger.error('Failed to register shortcuts:', error)
      } finally {
        setIsRegistering(false)
      }
    },
    [isRegistering],
  )

  const unregisterShortcut = useCallback(async (shortcut: string) => {
    try {
      await unregister(shortcut)
      setRegisteredShortcuts((prev) =>
        prev.filter((s) => s.shortcut !== shortcut),
      )
    } catch (error) {
      logger.error(`Failed to unregister shortcut ${shortcut}:`, error)
    }
  }, [])

  const unregisterAllShortcuts = useCallback(async () => {
    try {
      await unregisterAll()
      setRegisteredShortcuts([])
    } catch (error) {
      logger.error('Failed to unregister all shortcuts:', error)
    }
  }, [])

  useEffect(() => {
    return () => {
      unregisterAll().catch((error) => {
        logger.error('Failed to cleanup shortcuts on unmount:', error)
      })
    }
  }, [])

  return {
    registeredShortcuts,
    isRegistering,
    registerShortcuts,
    unregisterShortcut,
    unregisterAllShortcuts,
  }
}
