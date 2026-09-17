import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import { createLogger } from '~/utils/logger'
import { isDialogKey } from '../utils/isDialogKey'
import {
  type HandledNavigationKey,
  isEchoedNavigationKey,
} from '../utils/isEchoedNavigationKey'
import { isSlideEditorPageKey } from '../utils/isSlideEditorPageKey'
import { listenForNavigationShortcuts } from '../utils/navigationShortcutEvent'
import { shortcutFromKeyboardEvent } from '../utils/shortcutFromKeyboardEvent'

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
  // The last key the handlers acted on, to tell an echo from a real press.
  const lastHandledKeyRef = useRef<HandledNavigationKey | null>(null)

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
    // Offers the event to the enabled handlers, highest priority first, until
    // one of them handles it. Returns whether one did.
    const runHandlers = (event: KeyboardEvent): boolean => {
      const enabledHandlers = Array.from(handlersRef.current.values())
        .filter((h) => h.enabled)
        .sort((a, b) => b.priority - a.priority)

      if (enabledHandlers.length === 0) {
        return false
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
            return true
          }
        } catch (error) {
          logger.error(`Error in keyboard handler ${handler.id}:`, { error })
        }
      }
      return false
    }

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

      // Skip if user is in a contenteditable element (except Escape, and a
      // presenter remote's page keys pressed in a slide editor)
      if (
        event.target instanceof HTMLElement &&
        event.target.isContentEditable &&
        event.key !== 'Escape' &&
        !isSlideEditorPageKey(event)
      ) {
        return
      }

      // A dialog owns the keyboard, Escape included: left unhandled, Escape
      // cancels the dialog, while a page handler taking it would go back to the
      // list or hide the projection behind the dialog — and its preventDefault
      // would keep the dialog open.
      if (isDialogKey(event)) {
        return
      }

      const key: HandledNavigationKey = {
        shortcut: shortcutFromKeyboardEvent(event),
        source: 'keyboard',
        at: Date.now(),
      }
      if (isEchoedNavigationKey(lastHandledKeyRef.current, key)) {
        logger.debug(`Ignoring ${key.shortcut}: the shortcut already moved on`)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (runHandlers(event)) {
        lastHandledKeyRef.current = key
        event.stopPropagation()
      }
    }

    // A configured Next/Previous shortcut does what the open page does with its
    // own Next/Prev, so it is offered to the handlers as the page keys a
    // presenter remote sends, which every navigation handler binds to exactly
    // that. The page's rules for typing fields and open dialogs do not apply:
    // the shortcut is held OS-wide and never typed into anything.
    const stopListening = listenForNavigationShortcuts(
      ({ direction, shortcut }) => {
        const key: HandledNavigationKey = {
          shortcut,
          source: 'shortcut',
          at: Date.now(),
        }
        if (isEchoedNavigationKey(lastHandledKeyRef.current, key)) {
          logger.debug(`Ignoring shortcut ${shortcut}: the page key moved on`)
          return true
        }

        const pageKey = new KeyboardEvent('keydown', {
          key: direction === 'next' ? 'PageDown' : 'PageUp',
          cancelable: true,
        })
        if (!runHandlers(pageKey)) return false
        lastHandledKeyRef.current = key
        return true
      },
    )

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      stopListening()
    }
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
