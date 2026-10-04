import type { Locator, Page } from '@playwright/test'

import { speakCaption, startVoiceClock } from './demo-voice'

/**
 * Helpers for the short demo video every task attaches to its PR: a visible
 * cursor (Playwright videos never show the OS pointer) and on-screen notes.
 * Spread DEMO_RECORDING into test.use(), call installDemoOverlay in
 * beforeEach, then narrate each step with showCaption and click with
 * glideClick (each caption is also read aloud when recorded by
 * record-features.sh, see demo-voice.ts). Point at the bug or the new feature with highlight (red box,
 * arrow, label) and remove it with clearHighlights.
 */

const DEMO_VIEWPORT = { width: 1920, height: 1080 }

/** Records at 1080p; without an explicit video size Playwright shrinks it to 800×600. */
export const DEMO_RECORDING = {
  viewport: DEMO_VIEWPORT,
  video: { mode: 'on', size: DEMO_VIEWPORT },
} as const

/** Draws the cursor dot, a ripple on every click and an empty caption bar on each page load. */
export async function installDemoOverlay(page: Page): Promise<void> {
  startVoiceClock(page)
  await page.addInitScript(drawDemoOverlay)
}

/**
 * Shows a note at the bottom of the frame and holds it long enough to read,
 * and, when recording with voice, until the voice has finished reading it.
 */
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
  const shownAt = Date.now()
  const speechMs = await speakCaption(page, text)
  const holdUntil = shownAt + Math.max(holdMs, speechMs + 400)
  await page.waitForTimeout(Math.max(holdUntil - Date.now(), 0))
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

/**
 * Draws a red box around the element and, with a label, a red arrow pointing
 * at it from that label, so the viewer sees the bug (Before) or the fix/new
 * feature (After). Stays until clearHighlights; drawn above modal dialogs
 * too. If the element sits where the caption is, the caption moves to the top.
 */
export async function highlight(
  page: Page,
  locator: Locator,
  label = '',
): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('highlight: the element is not visible')
  await page.evaluate(drawHighlight, { box, label })
}

/** Removes every highlight and puts the caption back at the bottom. */
export async function clearHighlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('__demo_highlights')?.remove()
    document.getElementById('__demo_caption')?.classList.remove('__demo_top')
  })
}

type Box = { x: number; y: number; width: number; height: number }

function drawHighlight({ box, label }: { box: Box; label: string }) {
  const RED = 'rgb(239, 68, 68)'
  const PAD = 8
  const CAPTION_ZONE = 200
  const width = window.innerWidth
  const height = window.innerHeight
  const rect = {
    left: box.x - PAD,
    top: box.y - PAD,
    right: box.x + box.width + PAD,
    bottom: box.y + box.height + PAD,
  }

  const caption = document.getElementById('__demo_caption')
  const captionOnTop = rect.bottom > height - CAPTION_ZONE
  caption?.classList.toggle('__demo_top', captionOnTop)

  let layer = document.getElementById('__demo_highlights')
  if (!layer) {
    layer = document.createElement('div')
    layer.id = '__demo_highlights'
    // A popover sits in the browser's top layer, so it can be drawn above an
    // open modal <dialog>, which no z-index can beat.
    layer.setAttribute('popover', 'manual')
    layer.innerHTML = `<style>
      #__demo_highlights {
        position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none;
        max-height: none; margin: 0; padding: 0; border: 0; overflow: visible;
        background: transparent; pointer-events: none; z-index: 2147483644;
      }
      #__demo_highlights svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      #__demo_highlights .label {
        position: absolute; padding: 8px 16px; border-radius: 8px;
        background: ${RED}; color: white; font: 700 24px/1.2 system-ui, sans-serif;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); white-space: nowrap;
      }
      #__demo_caption.__demo_top { top: 48px; bottom: auto; }
    </style>`
    document.body.appendChild(layer)
  }
  // Re-enter the top layer so the highlights stay above a dialog opened since.
  if (layer.matches(':popover-open')) layer.hidePopover()
  layer.showPopover()

  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.innerHTML = `
    <defs><marker id="__demo_arrowhead" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${RED}" /></marker></defs>
    <rect x="${rect.left}" y="${rect.top}" width="${rect.right - rect.left}"
      height="${rect.bottom - rect.top}" rx="8" fill="none" stroke="${RED}"
      stroke-width="5" />`
  layer.appendChild(svg)
  if (!label) return

  const tag = document.createElement('div')
  tag.className = 'label'
  tag.textContent = label
  layer.appendChild(tag)
  const tagWidth = tag.offsetWidth
  const tagHeight = tag.offsetHeight

  // Put the label diagonally off the element, toward the roomier side of the
  // frame, and never inside the caption's band.
  const toRight = (rect.left + rect.right) / 2 < width / 2
  const below = (rect.top + rect.bottom) / 2 < height / 2
  const minTop = captionOnTop ? CAPTION_ZONE : 16
  const maxTop = height - tagHeight - (captionOnTop ? 16 : CAPTION_ZONE)
  const left = Math.min(
    Math.max(toRight ? rect.right + 60 : rect.left - 60 - tagWidth, 16),
    width - tagWidth - 16,
  )
  const top = Math.min(
    Math.max(below ? rect.bottom + 80 : rect.top - 80 - tagHeight, minTop),
    maxTop,
  )
  tag.style.left = `${left}px`
  tag.style.top = `${top}px`

  // The arrow runs from the label's center to the nearest point of the box;
  // the label is drawn over its start.
  const fromX = left + tagWidth / 2
  const fromY = top + tagHeight / 2
  const toX = Math.min(Math.max(fromX, rect.left), rect.right)
  const toY = Math.min(Math.max(fromY, rect.top), rect.bottom)
  const arrow = document.createElementNS(svgNs, 'line')
  arrow.setAttribute('x1', String(fromX))
  arrow.setAttribute('y1', String(fromY))
  arrow.setAttribute('x2', String(toX))
  arrow.setAttribute('y2', String(toY))
  arrow.setAttribute('stroke', RED)
  arrow.setAttribute('stroke-width', '5')
  arrow.setAttribute('stroke-linecap', 'round')
  arrow.setAttribute('marker-end', 'url(#__demo_arrowhead)')
  svg.appendChild(arrow)
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
