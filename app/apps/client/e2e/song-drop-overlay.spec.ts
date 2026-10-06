import { expect, type Page, test } from '@playwright/test'

/**
 * Dragging files over the desktop app shows the "drop to import" overlay;
 * dragging them back out must hide it again.
 *
 * A browser cannot drag files from the OS into a Tauri window, so the desktop
 * shell is stood in for by a `__TAURI_INTERNALS__` that sends Tauri's own
 * drag events (`tauri://drag-over`, `tauri://drag-leave`).
 */

async function fakeDesktopShell(page: Page) {
  await page.addInitScript(() => {
    const callbacks = new Map<number, (event: unknown) => void>()
    const listeners: Array<{ event: string; id: number }> = []
    let nextId = 1

    ;(window as unknown as Record<string, unknown>).__emitTauri = (
      event: string,
      payload: unknown,
    ) => {
      for (const listener of listeners) {
        if (listener.event !== event) continue
        callbacks.get(listener.id)?.({ event, id: listener.id, payload })
      }
    }

    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { windowLabel: 'main', label: 'main' },
      },
      transformCallback: (callback: (event: unknown) => void) => {
        const id = nextId++
        callbacks.set(id, callback)
        return id
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      convertFileSrc: (path: string) => path,
      invoke: async (
        command: string,
        args?: { event?: string; handler?: number },
      ) => {
        if (command !== 'plugin:event|listen') return null
        listeners.push({ event: args?.event ?? '', id: args?.handler ?? 0 })
        return args?.handler
      },
    }
  })
}

async function emitTauri(page: Page, event: string, payload: unknown) {
  await page.evaluate(
    ([name, data]) =>
      (
        window as unknown as {
          __emitTauri: (event: string, payload: unknown) => void
        }
      ).__emitTauri(name as string, data),
    [event, payload],
  )
}

const DROP_HINT = /Drop PPTX file to import as song|Trage/i

test('the drop overlay hides when files are dragged back out of the window', async ({
  page,
}) => {
  await fakeDesktopShell(page)
  await page.goto('/songs')
  await expect(page.getByRole('heading').first()).toBeVisible()

  await emitTauri(page, 'tauri://drag-over', { position: { x: 400, y: 300 } })
  await expect(page.getByText(DROP_HINT)).toBeVisible()

  await emitTauri(page, 'tauri://drag-leave', null)
  await expect(page.getByText(DROP_HINT)).toBeHidden()
})
