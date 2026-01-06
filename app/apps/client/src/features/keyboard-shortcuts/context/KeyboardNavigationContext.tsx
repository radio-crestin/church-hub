import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('keyboard-navigation')

/**
 * Handler priority levels - higher values take precedence
 * When multiple handlers are registered, only the highest priority enabled handler fires
 */
export const KEYBOARD_PRIORITY = {
  /** Default presentation navigation (AppLayout) - lowest priority */
  PRESENTATION: 0,
  /** Page-specific navigation (song preview, bible, etc.) */
  PAGE: 10,
  /** Modal/dialog navigation - highest priority */
  MODAL: 20,
} as const

export type KeyboardPriority =
  (typeof KEYBOARD_PRIORITY)[keyof typeof KEYBOARD_PRIORITY]

type KeyboardHandler = (event: KeyboardEvent) => boolean | void

interface RegisteredHandler {
  id: string
  priority: KeyboardPriority
  handler: KeyboardHandler
  enabled: boolean
}

interface KeyboardNavigationContextValue {
  /**
   * Register a keyboard handler
   * @param id Unique identifier for this handler
   * @param priority Handler priority - higher values take precedence
   * @param handler The keyboard event handler. Return true to stop propagation to lower priority handlers
   * @param enabled Whether the handler is currently active
   * @returns Cleanup function to unregister the handler
   */
  registerHandler: (
    id: string,
    priority: KeyboardPriority,
    handler: KeyboardHandler,
    enabled: boolean,
  ) => () => void

  /**
   * Update a handler's enabled state
   */
  setHandlerEnabled: (id: string, enabled: boolean) => void
}

const KeyboardNavigationContext =
  createContext<KeyboardNavigationContextValue | null>(null)

interface KeyboardNavigationProviderProps {
  children: React.ReactNode
}

export function KeyboardNavigationProvider({
  children,
}: KeyboardNavigationProviderProps) {
  const handlersRef = useRef<Map<string, RegisteredHandler>>(new Map())

  // Register a new handler
  const registerHandler = useCallback(
    (
      id: string,
      priority: KeyboardPriority,
      handler: KeyboardHandler,
      enabled: boolean,
    ): (() => void) => {
      logger.debug(
        `Registering keyboard handler: ${id} (priority: ${priority}, enabled: ${enabled})`,
      )

      handlersRef.current.set(id, { id, priority, handler, enabled })

      return () => {
        logger.debug(`Unregistering keyboard handler: ${id}`)
        handlersRef.current.delete(id)
      }
    },
    [],
  )

  // Update handler enabled state
  const setHandlerEnabled = useCallback((id: string, enabled: boolean) => {
    const handler = handlersRef.current.get(id)
    if (handler) {
      handler.enabled = enabled
      logger.debug(`Handler ${id} enabled: ${enabled}`)
    }
  }, [])

  // Single global keyboard event listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        // Exception: Escape should always work to close/exit
        if (event.key !== 'Escape') {
          return
        }
      }

      // Skip if user is in a contenteditable element (except Escape)
      if (
        event.target instanceof HTMLElement &&
        event.target.isContentEditable &&
        event.key !== 'Escape'
      ) {
        return
      }

      // Skip if any dialog/modal is open (native dialog element)
      const openDialog = document.querySelector('dialog[open]')
      if (openDialog && event.key !== 'Escape') {
        return
      }

      // Get all enabled handlers sorted by priority (highest first)
      const enabledHandlers = Array.from(handlersRef.current.values())
        .filter((h) => h.enabled)
        .sort((a, b) => b.priority - a.priority)

      if (enabledHandlers.length === 0) {
        return
      }

      logger.debug(
        `Keyboard event: ${event.key}, enabled handlers: ${enabledHandlers.map((h) => `${h.id}(${h.priority})`).join(', ')}`,
      )

      // Call handlers in priority order, stop if one returns true (handled)
      for (const handler of enabledHandlers) {
        try {
          const handled = handler.handler(event)
          if (handled === true) {
            logger.debug(`Event handled by: ${handler.id}`)
            return
          }
        } catch (error) {
          logger.error(`Error in keyboard handler ${handler.id}:`, { error })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo(
    () => ({
      registerHandler,
      setHandlerEnabled,
    }),
    [registerHandler, setHandlerEnabled],
  )

  return (
    <KeyboardNavigationContext.Provider value={value}>
      {children}
    </KeyboardNavigationContext.Provider>
  )
}

export function useKeyboardNavigation(): KeyboardNavigationContextValue {
  const context = useContext(KeyboardNavigationContext)
  if (!context) {
    throw new Error(
      'useKeyboardNavigation must be used within KeyboardNavigationProvider',
    )
  }
  return context
}

/**
 * Hook to register a keyboard navigation handler
 * Automatically handles registration and cleanup
 */
export function useKeyboardNavigationHandler(
  id: string,
  priority: KeyboardPriority,
  handler: KeyboardHandler,
  enabled: boolean = true,
) {
  const { registerHandler, setHandlerEnabled } = useKeyboardNavigation()

  // Register handler on mount, unregister on unmount
  useEffect(() => {
    const unregister = registerHandler(id, priority, handler, enabled)
    return unregister
  }, [id, priority, handler, registerHandler, enabled])

  // Update enabled state when it changes
  useEffect(() => {
    setHandlerEnabled(id, enabled)
  }, [id, enabled, setHandlerEnabled])
}
