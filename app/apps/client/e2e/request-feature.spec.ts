import { expect, type Page, test } from '@playwright/test'

/**
 * "Request a feature" works like a screenshot tool: pick an element, get a
 * screenshot with it outlined, draw on it, add notes and an email, send.
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
      json: { success: true, issueUrl: ISSUE_URL, issueNumber: 999 },
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

test.describe('Request a feature', () => {
  test.beforeEach(async ({ page }) => {
    await recordOpenedUrls(page)
  })

  test('picks an element, draws, sends a public request and opens the issue', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const trigger = page.getByTestId('sidebar-request-feature')
    // The test app may run in English or Romanian.
    await expect(trigger).toContainText(
      /Request a feature|Solicită o funcționalitate/,
    )
    await trigger.click()

    // Picker: hovering outlines the element under the pointer.
    const picker = page.getByTestId('feature-request-picker')
    await expect(picker).toBeVisible()
    const box = await trigger.boundingBox()
    if (!box) throw new Error('Request a feature button has no box')
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(center.x, center.y)
    await expect(page.getByTestId('feature-request-highlight')).toBeVisible()
    await page.mouse.click(center.x, center.y)

    // Editor: screenshot with a pen, the exact element path, a public warning.
    const dialog = page.getByTestId('feature-request-dialog')
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(picker).toBeHidden()
    const selector = await dialog
      .getByTestId('feature-request-element-selector')
      .textContent()
    expect(selector).toBeTruthy()
    const selectorFindsTheButton = await page.evaluate(
      (css) =>
        document.querySelector(css as string)?.getAttribute('data-testid') ===
          'sidebar-request-feature' ||
        document
          .querySelector(css as string)
          ?.closest('[data-testid="sidebar-request-feature"]') !== null,
      selector,
    )
    expect(selectorFindsTheButton).toBe(true)
    await expect(
      dialog.getByTestId('feature-request-public-notice'),
    ).toContainText(/public/i)

    const canvas = dialog.getByTestId('feature-request-canvas')
    await expect(canvas).toBeVisible()
    const undo = dialog.getByTestId('feature-request-undo')
    await expect(undo).toBeDisabled()
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('Screenshot canvas has no box')
    await page.mouse.move(canvasBox.x + 20, canvasBox.y + 20)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + 80, canvasBox.y + 60, { steps: 5 })
    await page.mouse.up()
    await expect(undo).toBeEnabled()

    await dialog.getByTestId('feature-request-title').fill('E2E: bigger font')
    await dialog
      .getByTestId('feature-request-notes')
      .fill('Let me choose the font size of song titles.')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(request.title).toBe('E2E: bigger font')
    expect(request.notes).toBe('Let me choose the font size of song titles.')
    expect(request.email).toBe(EMAIL)
    expect(request.route).toBe('/songs')
    expect(request.viewport).toBe('1280x800')
    expect(request.element?.selector).toBe(selector)
    expect(request.element?.path).toContain('button')
    expect(request.screenshot).toMatch(/^data:image\/jpeg;base64,/)

    // The created issue is opened for the user.
    await expect.poll(() => openedUrls(page)).toContain(ISSUE_URL)
  })

  test('remembers the email for the next request', async ({ page }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    await page.getByTestId('sidebar-request-feature').click()
    await page.getByTestId('feature-request-whole-screen').click()
    const dialog = page.getByTestId('feature-request-dialog')
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(
      dialog.getByTestId('feature-request-element-label'),
    ).toContainText(/Whole screen|Tot ecranul/)
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-title').click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.reload()
    await page.getByTestId('sidebar-request-feature').click()
    await page.getByTestId('feature-request-whole-screen').click()
    await expect(
      page
        .getByTestId('feature-request-dialog')
        .getByTestId('feature-request-email'),
    ).toHaveValue(EMAIL, { timeout: 20000 })
  })

  test('Escape leaves the picker without sending anything', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    await page.getByTestId('sidebar-request-feature').click()
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

    await page.getByTestId('sidebar-request-feature').click()
    await page.getByTestId('feature-request-whole-screen').click()
    const dialog = page.getByTestId('feature-request-dialog')
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await dialog.getByTestId('feature-request-title').fill('E2E: failing')
    await dialog.getByTestId('feature-request-notes').fill('Should fail')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
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

    await page.getByTestId('sidebar-request-feature').click()
    await page.getByTestId('feature-request-whole-screen').click()
    const dialog = page.getByTestId('feature-request-dialog')
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await dialog.getByTestId('feature-request-title').fill('E2E: limited')
    await dialog.getByTestId('feature-request-notes').fill('Too many')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toContainText(/50/)
    expect(await openedUrls(page)).toEqual([])
  })
})
