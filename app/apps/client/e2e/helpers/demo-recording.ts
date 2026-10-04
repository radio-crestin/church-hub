import type { Locator, Page } from '@playwright/test'

/**
 * Helpers for the short demo video every task attaches to its PR: a visible
 * cursor (Playwright videos never show the OS pointer) and on-screen notes.
 * Spread DEMO_RECORDING into test.use(), call installDemoOverlay in
 * beforeEach, then narrate each step with showCaption and click with
 * glideClick.
 */

const DEMO_VIEWPORT = { width: 1920, height: 1080 }

/** Records at 1080p; without an explicit video size Playwright shrinks it to 800×600. */
export const DEMO_RECORDING = {
  viewport: DEMO_VIEWPORT,
  video: { mode: 'on', size: DEMO_VIEWPORT },
} as const

/** Draws the cursor dot, a ripple on every click and an empty caption bar on each page load. */
export async function installDemoOverlay(page: Page): Promise<void> {
  await page.addInitScript(drawDemoOverlay)
}

/** Shows a note at the bottom of the frame and holds it long enough to read. */
export async function showCaption(
  page: Page,
  text: string,
  holdMs = 1500,
): Promise<void> {
  await page.evaluate((captionText) => {
    const caption = document.getElementById('__demo_caption')
    if (!caption) return
    caption.textContent = captionText
    caption.style.opacity = captionText ? '1' : '0'
  }, text)
  await page.waitForTimeout(holdMs)
}

/** Moves the cursor visibly to the element before clicking, instead of teleporting. */
export async function glideClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 25,
    })
    await page.waitForTimeout(200)
  }
  await locator.click()
}

function drawDemoOverlay() {
  function inject() {
    if (document.getElementById('__demo_cursor')) return
    const style = document.createElement('style')
    style.textContent = `
      @keyframes __demo_ripple {
        from { transform: scale(0.4); opacity: 0.95; }
        to   { transform: scale(2.4); opacity: 0; }
      }
      #__demo_cursor {
        position: fixed; top: 0; left: 0; width: 22px; height: 22px;
        border-radius: 50%; background: rgba(99, 102, 241, 0.9);
        box-shadow: 0 0 0 2px white, 0 0 12px rgba(0, 0, 0, 0.45);
        pointer-events: none; z-index: 2147483647;
        transform: translate(-100px, -100px); transition: transform 0.08s ease-out;
      }
      .__demo_ripple {
        position: fixed; width: 48px; height: 48px; border-radius: 50%;
        border: 3px solid rgb(99, 102, 241); pointer-events: none;
        z-index: 2147483646; animation: __demo_ripple 0.6s ease-out forwards;
      }
      #__demo_caption {
        position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%);
        max-width: 80%; padding: 14px 28px; border-radius: 12px;
        background: rgba(15, 23, 42, 0.88); color: white;
        font: 600 28px/1.3 system-ui, sans-serif; text-align: center;
        pointer-events: none; z-index: 2147483645;
        opacity: 0; transition: opacity 0.25s ease;
      }
    `
    document.head.appendChild(style)

    const cursor = document.createElement('div')
    cursor.id = '__demo_cursor'
    const caption = document.createElement('div')
    caption.id = '__demo_caption'
    document.body.append(cursor, caption)

    document.addEventListener(
      'mousemove',
      (event) => {
        cursor.style.transform = `translate(${event.clientX - 11}px, ${event.clientY - 11}px)`
      },
      true,
    )
    document.addEventListener(
      'mousedown',
      (event) => {
        const ripple = document.createElement('div')
        ripple.className = '__demo_ripple'
        ripple.style.left = `${event.clientX - 24}px`
        ripple.style.top = `${event.clientY - 24}px`
        document.body.appendChild(ripple)
        setTimeout(() => ripple.remove(), 700)
      },
      true,
    )
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject)
  } else {
    inject()
  }
}
