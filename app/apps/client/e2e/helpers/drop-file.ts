import { expect, type Page } from '@playwright/test'

/**
 * Drops a file on the page the way a user drags one in, once the app's
 * document drop listener is attached (`<html data-file-drop-ready>`): a drop
 * dispatched before then is lost.
 */
export async function dropFile(
  page: Page,
  bytes: Buffer,
  name: string,
  type = '',
) {
  await expect(page.locator('html')).toHaveAttribute(
    'data-file-drop-ready',
    'true',
  )
  await page.evaluate(
    ({ base64, fileName, mime }) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([data], fileName, { type: mime }))
      document.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      )
    },
    { base64: bytes.toString('base64'), fileName: name, mime: type },
  )
}
