import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * "Request a feature" is screenshot first: opening it photographs the screen,
 * a short two-step flow lets the user draw on it (a friendly nudge, optional)
 * and then write the request and send it.
 * The local API (which relays to the Cloudflare worker, and from there to
 * GitHub and WhatsApp) is mocked here, so no real issue or message is made.
 */

const ISSUE_URL = 'https://github.com/radio-crestin/church-hub/issues/999'
const EMAIL = 'e2e-requester@example.com'

interface SentRequest {
  title: string
  notes: string
  email: string
  route: string
  viewport: string
  element?: { selector: string; path: string; label: string }
  screenshot?: string
}

/** Mocks the relay endpoint and records what the app sends. */
async function mockFeatureRequestApi(page: Page): Promise<SentRequest[]> {
  const sent: SentRequest[] = []
  await page.route('**/api/feature-requests', async (route) => {
    sent.push(route.request().postDataJSON() as SentRequest)
    await route.fulfill({
      json: {
        success: true,
        issueUrl: ISSUE_URL,
        issueNumber: 999,
        whatsAppSent: true,
      },
    })
  })
  return sent
}

/** Records window.open calls instead of opening tabs (the web app path). */
async function recordOpenedUrls(page: Page) {
  await page.addInitScript(() => {
    const opened: string[] = []
    ;(window as unknown as { __openedUrls: string[] }).__openedUrls = opened
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
  })
}

function openedUrls(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __openedUrls: string[] }).__openedUrls,
  )
}

async function openSongsPage(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/songs')
  await expect(page.getByTestId('sidebar-request-feature')).toBeVisible({
    timeout: 15000,
  })
}

/** Opens the tool and waits for the screenshot step. */
async function openRequestFeature(page: Page) {
  await page.getByTestId('sidebar-request-feature').click()
  const dialog = page.getByTestId('feature-request-dialog')
  await expect(dialog).toBeVisible({ timeout: 20000 })
  return dialog
}

/** Moves on to the writing step. */
async function goToWriting(dialog: Locator) {
  await dialog.getByTestId('feature-request-next').click()
  await expect(dialog.getByTestId('feature-request-title')).toBeVisible()
}

async function fillRequest(dialog: Locator, title: string, notes: string) {
  await dialog.getByTestId('feature-request-title').fill(title)
  await dialog.getByTestId('feature-request-notes').fill(notes)
  await dialog.getByTestId('feature-request-email').fill(EMAIL)
}

async function drawOnScreenshot(page: Page, dialog: Locator) {
  const canvasBox = await dialog
    .getByTestId('feature-request-canvas')
    .boundingBox()
  if (!canvasBox) throw new Error('Screenshot canvas has no box')
  await page.mouse.move(canvasBox.x + 20, canvasBox.y + 20)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 60, { steps: 5 })
  await page.mouse.up()
}

test.describe('Request a feature', () => {
  test.beforeEach(async ({ page }) => {
    await recordOpenedUrls(page)
  })

  test('takes the screenshot right away, nudges to draw, then sends a public request', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const trigger = page.getByTestId('sidebar-request-feature')
    // The test app may run in English or Romanian.
    await expect(trigger).toContainText(
      /Request a feature|Propune o funcție nouă/,
    )
    await trigger.click()

    // Step 1: no picker first; the screenshot is already there, with a nudge.
    const dialog = page.getByTestId('feature-request-dialog')
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('feature-request-picker')).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-progress')).toContainText(
      /1.*2/,
    )
    await expect(dialog.getByTestId('feature-request-draw-hint')).toBeVisible()
    await expect(dialog.getByTestId('feature-request-canvas')).toBeVisible()
    const pen = dialog.getByTestId('feature-request-pen')
    await expect(pen).toHaveAttribute('data-pulsing', 'true')

    const undo = dialog.getByTestId('feature-request-undo')
    await expect(undo).toBeDisabled()
    await drawOnScreenshot(page, dialog)
    await expect(undo).toBeEnabled()
    await expect(pen).toHaveAttribute('data-pulsing', 'false')

    // Step 2: write the request; a preview shows the drawing that goes along.
    await goToWriting(dialog)
    await expect(dialog.getByTestId('feature-request-progress')).toContainText(
      /2.*2/,
    )
    await expect(dialog.getByTestId('feature-request-preview')).toBeVisible()
    await expect(
      dialog.getByTestId('feature-request-public-notice'),
    ).toContainText(/public/i)
    await dialog.getByTestId('feature-request-notes').fill('Hello')
    await expect(
      dialog.getByTestId('feature-request-notes-counter'),
    ).toContainText('5 / 5000')
    await expect(dialog.getByTestId('feature-request-submit')).toBeDisabled()

    await fillRequest(
      dialog,
      'E2E: bigger font',
      'Let me choose the font size of song titles.',
    )
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(request.title).toBe('E2E: bigger font')
    expect(request.notes).toBe('Let me choose the font size of song titles.')
    expect(request.email).toBe(EMAIL)
    expect(request.route).toBe('/songs')
    expect(request.viewport).toBe('1280x800')
    expect(request.element).toBeUndefined()
    expect(request.screenshot).toMatch(/^data:image\/jpeg;base64,/)

    // The created issue is opened for the user.
    await expect.poll(() => openedUrls(page)).toContain(ISSUE_URL)
  })

  test('pointing at a part of the app sends its exact path', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const trigger = page.getByTestId('sidebar-request-feature')
    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-pick-element').click()

    // Picker: hovering outlines the element under the pointer.
    const picker = page.getByTestId('feature-request-picker')
    await expect(picker).toBeVisible()
    const box = await trigger.boundingBox()
    if (!box) throw new Error('Request a feature button has no box')
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(center.x, center.y)
    await expect(page.getByTestId('feature-request-highlight')).toBeVisible()
    await page.mouse.click(center.x, center.y)

    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(picker).toBeHidden()
    await expect(
      dialog.getByTestId('feature-request-element-label'),
    ).not.toContainText(/Whole screen|Tot ecranul/)
    await goToWriting(dialog)
    await fillRequest(dialog, 'E2E: pointed', 'About this button')
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()

    const [request] = sent
    expect(request.element?.path).toContain('button')
    const selectorFindsTheButton = await page.evaluate(
      (css) =>
        document
          .querySelector(css)
          ?.closest('[data-testid="sidebar-request-feature"]') != null,
      request.element?.selector ?? '',
    )
    expect(selectorFindsTheButton).toBe(true)
  })

  test('takes the screenshot again on another page of the app', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await drawOnScreenshot(page, dialog)
    await goToWriting(dialog)
    await fillRequest(dialog, 'E2E: other page', 'Seen on the settings page')
    await dialog.getByTestId('feature-request-back').click()

    // Leave the dialog, go elsewhere, and photograph that page instead.
    await dialog.getByTestId('feature-request-roam').click()
    const bar = page.getByTestId('feature-request-roaming')
    await expect(bar).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await page.locator('a[href="/settings"]').first().click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(bar).toBeVisible()
    await page.getByTestId('feature-request-take').click()

    // Back in the flow: the new picture is undrawn, the typed text is kept.
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(bar).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-undo')).toBeDisabled()
    await goToWriting(dialog)
    await expect(dialog.getByTestId('feature-request-title')).toHaveValue(
      'E2E: other page',
    )
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].route).toMatch(/^\/settings/)
    expect(sent[0].screenshot).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('cancelling the other-page bar returns to the same screenshot', async ({
    page,
  }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await drawOnScreenshot(page, dialog)
    await dialog.getByTestId('feature-request-roam').click()
    await page.getByTestId('feature-request-roaming-cancel').click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('feature-request-undo')).toBeEnabled()
  })

  test('captures another screen or window through the system picker', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    // The real picker is an OS dialog: stand in a picture of "another screen".
    await page.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 360
        const context = canvas.getContext('2d')
        if (context) {
          context.fillStyle = '#123456'
          context.fillRect(0, 0, 640, 360)
        }
        return canvas.captureStream(5)
      }
    })
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-capture-display').click()
    await expect(dialog.getByTestId('feature-request-canvas')).toHaveJSProperty(
      'width',
      640,
    )
    await goToWriting(dialog)
    await fillRequest(dialog, 'E2E: other screen', 'From the projector')
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].screenshot).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('leaves the screenshot out when the switch is turned off', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    const toggle = dialog.getByTestId('feature-request-include-screenshot')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(dialog.getByTestId('feature-request-canvas')).toHaveCount(0)
    await goToWriting(dialog)
    await expect(dialog.getByTestId('feature-request-preview')).toHaveCount(0)
    await fillRequest(dialog, 'E2E: no picture', 'Text only')
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()

    expect(sent[0].screenshot).toBeUndefined()
  })

  test('Back returns to the drawing and keeps it', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await drawOnScreenshot(page, dialog)
    await goToWriting(dialog)
    await dialog.getByTestId('feature-request-back').click()
    await expect(dialog.getByTestId('feature-request-undo')).toBeEnabled()
  })

  test('fits a phone screen', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/songs')
    await page
      .getByRole('button', { name: /Open menu|Deschide meniu/ })
      .click({ timeout: 15000 })
    const dialog = await openRequestFeature(page)
    await expect(dialog.getByTestId('feature-request-next')).toBeInViewport()
    await goToWriting(dialog)
    await expect(dialog.getByTestId('feature-request-submit')).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 0).toBeLessThanOrEqual(390)
  })

  test('remembers the email for the next request', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await goToWriting(dialog)
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-title').click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.reload()
    const reopened = await openRequestFeature(page)
    await goToWriting(reopened)
    await expect(reopened.getByTestId('feature-request-email')).toHaveValue(
      EMAIL,
    )
  })

  test('Escape leaves the picker without sending anything', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-pick-element').click()
    await expect(page.getByTestId('feature-request-picker')).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('feature-request-picker')).toBeHidden()
    await expect(page.getByTestId('feature-request-dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/songs/)
    expect(sent).toHaveLength(0)
  })

  test('shows an error and keeps the form when the backend fails', async ({
    page,
  }) => {
    await page.route('**/api/feature-requests', (route) =>
      route.fulfill({
        status: 502,
        json: { success: false, error: 'Could not reach the backend' },
      }),
    )
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await goToWriting(dialog)
    await fillRequest(dialog, 'E2E: failing', 'Should fail')
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByTestId('feature-request-title')).toHaveValue(
      'E2E: failing',
    )
    expect(await openedUrls(page)).toEqual([])
  })

  test('explains the daily limit when the backend rate-limits the network', async ({
    page,
  }) => {
    await page.route('**/api/feature-requests', (route) =>
      route.fulfill({
        status: 429,
        json: { success: false, code: 'rate_limited', error: 'Too many' },
      }),
    )
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await goToWriting(dialog)
    await fillRequest(dialog, 'E2E: limited', 'Too many')
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toContainText(/50/)
    expect(await openedUrls(page)).toEqual([])
  })
})
