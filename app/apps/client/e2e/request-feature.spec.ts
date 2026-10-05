import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * "Request a feature" is one short form: opening it photographs the screen,
 * then the user writes what they would like (required), may draw on the
 * screenshot, gives an email and sends. There is no title.
 * The local API (which relays to the Cloudflare worker, and from there to
 * GitHub and WhatsApp) is mocked here, so no real issue or message is made.
 */

const ISSUE_URL = 'https://github.com/radio-crestin/church-hub/issues/999'
const EMAIL = 'e2e-requester@example.com'

interface SentRequest {
  title?: string
  notes: string
  email: string
  route: string
  viewport: string
  element?: unknown
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

/** Opens the tool and waits for the form. */
async function openRequestFeature(page: Page) {
  await page.getByTestId('sidebar-request-feature').click()
  const dialog = page.getByTestId('feature-request-dialog')
  await expect(dialog).toBeVisible({ timeout: 20000 })
  return dialog
}

async function fillRequest(dialog: Locator, notes: string) {
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

  test('one short form: describe, draw, send a public request without a title', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const trigger = page.getByTestId('sidebar-request-feature')
    // The test app may run in English or Romanian.
    await expect(trigger).toContainText(
      /Request a feature|Propune o funcție nouă/,
    )
    const dialog = await openRequestFeature(page)

    // Everything on one screen: no steps, no title, the description first.
    await expect(dialog.getByTestId('feature-request-title')).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-next')).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-notes')).toBeFocused()
    await expect(dialog.getByTestId('feature-request-canvas')).toBeVisible()
    await expect(dialog.getByTestId('feature-request-draw-hint')).toBeVisible()
    await expect(
      dialog.getByTestId('feature-request-public-notice'),
    ).toContainText(/GitHub/)

    const undo = dialog.getByTestId('feature-request-undo')
    await expect(undo).toBeDisabled()
    await drawOnScreenshot(page, dialog)
    await expect(undo).toBeEnabled()

    await fillRequest(dialog, 'Let me choose the font size of song titles.')
    await expect(
      dialog.getByTestId('feature-request-notes-counter'),
    ).toContainText('43 / 5000')
    await expect(
      dialog.getByTestId('feature-request-missing-hint'),
    ).toHaveCount(0)
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(request.title).toBeUndefined()
    expect(request.element).toBeUndefined()
    expect(request.notes).toBe('Let me choose the font size of song titles.')
    expect(request.email).toBe(EMAIL)
    expect(request.route).toBe('/songs')
    expect(request.viewport).toBe('1280x800')
    expect(request.screenshot).toMatch(/^data:image\/jpeg;base64,/)

    // The created issue is opened for the user.
    await expect.poll(() => openedUrls(page)).toContain(ISSUE_URL)
  })

  test('Send stays off with a hint until the description is written', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    const submit = dialog.getByTestId('feature-request-submit')
    const hint = dialog.getByTestId('feature-request-missing-hint')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await expect(submit).toBeDisabled()
    await expect(hint).toContainText(/Describe|Descrie/)

    // Spaces alone do not count as a description.
    await dialog.getByTestId('feature-request-notes').fill('   ')
    await expect(submit).toBeDisabled()

    // Without a valid email it stays off too, with its own hint.
    await dialog.getByTestId('feature-request-notes').fill('Bigger font')
    await dialog.getByTestId('feature-request-email').fill('not-an-email')
    await expect(submit).toBeDisabled()
    await expect(hint).toContainText(/email|e-mail/)

    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await expect(hint).toHaveCount(0)
    await expect(submit).toBeEnabled()
    expect(sent).toHaveLength(0)
  })

  test('retakes the screenshot on another page and keeps the text', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await fillRequest(dialog, 'Seen on the settings page')
    await drawOnScreenshot(page, dialog)

    // Leave the dialog, go elsewhere, and photograph that page instead.
    await dialog.getByTestId('feature-request-retake').click()
    const bar = page.getByTestId('feature-request-roaming')
    await expect(bar).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await page.locator('a[href="/settings"]').first().click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(bar).toBeVisible()
    await page.getByTestId('feature-request-take').click()

    // Back in the form: the new picture is undrawn, the typed text is kept.
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(bar).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-undo')).toBeDisabled()
    await expect(dialog.getByTestId('feature-request-notes')).toHaveValue(
      'Seen on the settings page',
    )
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].route).toMatch(/^\/settings/)
    expect(sent[0].screenshot).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('cancelling the retake bar returns to the same screenshot', async ({
    page,
  }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await drawOnScreenshot(page, dialog)
    await dialog.getByTestId('feature-request-retake').click()
    await page.getByTestId('feature-request-roaming-cancel').click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('feature-request-undo')).toBeEnabled()
  })

  test('Escape on the retake bar returns to the form without sending', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-retake').click()
    await expect(page.getByTestId('feature-request-roaming')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('feature-request-roaming')).toHaveCount(0)
    await expect(dialog).toBeVisible()
    expect(sent).toHaveLength(0)
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
    await dialog.getByTestId('feature-request-retake').click()
    await page.getByTestId('feature-request-capture-display').click()
    await expect(dialog.getByTestId('feature-request-canvas')).toHaveJSProperty(
      'width',
      640,
    )
    await fillRequest(dialog, 'From the projector')
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
    await fillRequest(dialog, 'Text only')
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()

    expect(sent[0].screenshot).toBeUndefined()
  })

  test('fits a phone screen', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/songs')
    await page
      .getByRole('button', { name: /Open menu|Deschide meniu/ })
      .click({ timeout: 15000 })
    const dialog = await openRequestFeature(page)
    await expect(dialog.getByTestId('feature-request-notes')).toBeInViewport()
    await dialog.getByTestId('feature-request-submit').scrollIntoViewIfNeeded()
    await expect(dialog.getByTestId('feature-request-submit')).toBeInViewport()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 0).toBeLessThanOrEqual(390)
  })

  test('remembers the email for the next request', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-notes').click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.reload()
    const reopened = await openRequestFeature(page)
    await expect(reopened.getByTestId('feature-request-email')).toHaveValue(
      EMAIL,
    )
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
    await fillRequest(dialog, 'Should fail')
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByTestId('feature-request-notes')).toHaveValue(
      'Should fail',
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
    await fillRequest(dialog, 'Too many')
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toContainText(/50/)
    expect(await openedUrls(page)).toEqual([])
  })
})
