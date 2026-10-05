import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * "Feedback" (the request tool) is one screen: opening it photographs the screen; the
 * screenshot with an iPad-style markup bar is on top, an optional
 * description and an optional email below, then Send. There is no title.
 * The notes on the screenshot also go as text.
 * The local API (which relays to the Cloudflare worker, and from there to
 * GitHub and WhatsApp) is mocked here, so no real issue or message is made.
 */

const ISSUE_URL = 'https://github.com/radio-crestin/church-hub/issues/999'
const EMAIL = 'e2e-requester@example.com'

interface SentRequest {
  title?: string
  notes: string
  screenshotNotes?: string[]
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

async function canvasBox(dialog: Locator) {
  const box = await dialog.getByTestId('feature-request-canvas').boundingBox()
  if (!box) throw new Error('Screenshot canvas has no box')
  return box
}

async function drawOnScreenshot(page: Page, dialog: Locator) {
  const box = await canvasBox(dialog)
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 })
  await page.mouse.up()
}

/** Picks the note tool, clicks a spot on the screenshot and types the note. */
async function addNote(page: Page, dialog: Locator, text: string, at = 0.4) {
  await dialog.getByTestId('feature-request-tool-note').click()
  const box = await canvasBox(dialog)
  await page.mouse.click(box.x + box.width * at, box.y + box.height * at)
  const input = dialog.getByTestId('feature-request-note-input')
  await expect(input).toBeFocused()
  await input.fill(text)
  await input.press('Enter')
  await expect(input).toHaveCount(0)
}

test.describe('Request a feature', () => {
  test.beforeEach(async ({ page }) => {
    await recordOpenedUrls(page)
  })

  test('one screen: mark up, then send without a title, description or email', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const trigger = page.getByTestId('sidebar-request-feature')
    // Named "Feedback" in English and Romanian alike.
    await expect(trigger).toContainText('Feedback')
    await expect(trigger).not.toContainText(/Propune|Request a feature/)
    const dialog = await openRequestFeature(page)
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(
      'Feedback',
    )

    // Markup on top with the pen ready; the description below has the focus.
    await expect(dialog.getByTestId('feature-request-notes')).toBeFocused()
    await expect(dialog.getByTestId('feature-request-next')).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-title')).toHaveCount(0)
    await expect(
      dialog.getByTestId('feature-request-tool-pen'),
    ).toHaveAttribute('aria-pressed', 'true')
    const undo = dialog.getByTestId('feature-request-undo')
    await expect(undo).toBeDisabled()
    await drawOnScreenshot(page, dialog)
    await expect(undo).toBeEnabled()

    await addNote(page, dialog, 'Bigger font here')
    await addNote(page, dialog, 'And a dark theme', 0.7)

    // Description and email are both optional.
    await expect(
      dialog.getByTestId('feature-request-public-notice'),
    ).toContainText(/GitHub/)
    await expect(
      dialog.getByTestId('feature-request-missing-hint'),
    ).toHaveCount(0)
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(request.title).toBeUndefined()
    expect(request.email).toBeUndefined()
    expect(request.element).toBeUndefined()
    expect(request.notes).toBe('')
    expect(request.screenshotNotes).toEqual([
      'Bigger font here',
      'And a dark theme',
    ])
    expect(request.route).toBe('/songs')
    expect(request.viewport).toBe('1280x800')
    expect(request.screenshot).toMatch(/^data:image\/jpeg;base64,/)

    // The created issue is opened for the user.
    await expect.poll(() => openedUrls(page)).toContain(ISSUE_URL)
  })

  test('Escape drops a note being typed and keeps the dialog open', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await dialog.getByTestId('feature-request-tool-note').click()
    const box = await canvasBox(dialog)
    await page.mouse.click(box.x + 50, box.y + 50)
    const input = dialog.getByTestId('feature-request-note-input')
    await input.fill('Not this one')
    await input.press('Escape')

    await expect(input).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('feature-request-undo')).toBeDisabled()

    // An empty note is not kept either.
    await page.mouse.click(box.x + 80, box.y + 80)
    await expect(input).toBeFocused()
    await page.mouse.click(box.x + 200, box.y + 200)
    await expect(dialog.getByTestId('feature-request-undo')).toBeDisabled()
    expect(sent).toHaveLength(0)
  })

  test('Undo removes the last thing added, note or drawing', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await addNote(page, dialog, 'First note')
    await dialog.getByTestId('feature-request-tool-pen').click()
    await drawOnScreenshot(page, dialog)
    await addNote(page, dialog, 'Second note', 0.6)
    await dialog.getByTestId('feature-request-undo').click()

    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].screenshotNotes).toEqual(['First note'])
  })

  test('markup bar: shapes in the chosen colour, a cursor per tool', async ({
    page,
  }) => {
    await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    const canvas = dialog.getByTestId('feature-request-canvas')
    const cursor = () => canvas.evaluate((element) => element.style.cursor)
    const undo = dialog.getByTestId('feature-request-undo')

    // The pen is ready, with a pencil cursor in the chosen colour (red).
    await expect(dialog.getByTestId('feature-request-toolbar')).toBeVisible()
    expect(await cursor()).toContain('%23ef4444')
    await dialog.getByTestId('feature-request-color-3b82f6').click()
    await expect(
      dialog.getByTestId('feature-request-color-3b82f6'),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await cursor()).toContain('%233b82f6')

    // Shapes use a crosshair; a click without dragging adds nothing.
    await dialog.getByTestId('feature-request-tool-rect').click()
    expect(await cursor()).toBe('crosshair')
    const box = await canvasBox(dialog)
    await page.mouse.click(box.x + 30, box.y + 30)
    await expect(undo).toBeDisabled()

    // A dragged rectangle is drawn in blue on the screenshot.
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
      steps: 5,
    })
    await page.mouse.up()
    await expect(undo).toBeEnabled()
    const edgePixel = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement
      const context = target.getContext('2d')
      const x = Math.round(target.width * 0.4)
      const y = Math.round(target.height * 0.2)
      return Array.from(context?.getImageData(x, y, 1, 1).data ?? [])
    })
    expect(edgePixel[2]).toBeGreaterThan(200)
    expect(edgePixel[0]).toBeLessThan(120)

    // The other tools: arrow and circle draw too; text notes get a text cursor.
    for (const tool of ['arrow', 'ellipse', 'highlighter'] as const) {
      await dialog.getByTestId(`feature-request-tool-${tool}`).click()
      await drawOnScreenshot(page, dialog)
    }
    await dialog.getByTestId('feature-request-tool-note').click()
    expect(await cursor()).toBe('text')
    await expect(dialog.getByTestId('feature-request-tool-hint')).toBeVisible()
  })

  test('Send waits for something to send and for a valid email, if any', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    // Without the screenshot and without a description there is nothing to send.
    await dialog.getByTestId('feature-request-include-screenshot').click()
    const submit = dialog.getByTestId('feature-request-submit')
    const hint = dialog.getByTestId('feature-request-missing-hint')
    await expect(submit).toBeDisabled()
    await expect(hint).toContainText(/description|descriere/)

    await dialog.getByTestId('feature-request-notes').fill('Bigger font')
    await dialog.getByTestId('feature-request-email').fill('not-an-email')
    await expect(submit).toBeDisabled()
    await expect(hint).toContainText(/email|e-mail/)

    await dialog.getByTestId('feature-request-email').fill('')
    await expect(hint).toHaveCount(0)
    await expect(submit).toBeEnabled()
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await expect(submit).toBeEnabled()
    expect(sent).toHaveLength(0)
  })

  test('retakes the screenshot on another page and keeps the text', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await addNote(page, dialog, 'Old page note')
    await dialog
      .getByTestId('feature-request-notes')
      .fill('Seen on the settings page')

    // Leave the dialog, go elsewhere, and photograph that page instead.
    await dialog.getByTestId('feature-request-retake').click()
    const bar = page.getByTestId('feature-request-roaming')
    await expect(bar).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await page.locator('a[href="/settings"]').first().click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(bar).toBeVisible()
    await page.getByTestId('feature-request-take').click()

    // Back in the form: the new picture is clean, the typed text is kept.
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(bar).toHaveCount(0)
    await expect(dialog.getByTestId('feature-request-undo')).toBeDisabled()
    await expect(dialog.getByTestId('feature-request-notes')).toHaveValue(
      'Seen on the settings page',
    )
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].route).toMatch(/^\/settings/)
    expect(sent[0].screenshotNotes).toEqual([])
    expect(sent[0].screenshot).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('cancelling the retake bar returns to the same marked-up screenshot', async ({
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

  test('Escape on the retake bar returns to the dialog without sending', async ({
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
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()
    expect(sent[0].screenshot).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('leaves the screenshot and its notes out when the switch is off', async ({
    page,
  }) => {
    const sent = await mockFeatureRequestApi(page)
    await openSongsPage(page)

    const dialog = await openRequestFeature(page)
    await addNote(page, dialog, 'On the picture')
    const toggle = dialog.getByTestId('feature-request-include-screenshot')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(dialog.getByTestId('feature-request-canvas')).toHaveCount(0)
    await dialog.getByTestId('feature-request-notes').fill('Text only')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()
    await expect(dialog.getByTestId('feature-request-success')).toBeVisible()

    expect(sent[0].screenshot).toBeUndefined()
    expect(sent[0].screenshotNotes).toEqual([])
  })

  for (const phone of [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    test(`on a ${phone.width}px phone the screenshot uses the full width`, async ({
      page,
    }) => {
      await mockFeatureRequestApi(page)
      await page.setViewportSize(phone)
      await page.goto('/songs')
      await page
        .getByRole('button', { name: /Open menu|Deschide meniu/ })
        .click({ timeout: 15000 })
      const dialog = await openRequestFeature(page)
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox?.width ?? 0).toBeLessThanOrEqual(phone.width)

      // The form's own width: the description field spans it.
      const formWidth =
        (await dialog.getByTestId('feature-request-notes').boundingBox())
          ?.width ?? 0
      const canvas = await canvasBox(dialog)
      const toolbar = await dialog
        .getByTestId('feature-request-toolbar')
        .boundingBox()
      expect(canvas.width).toBeGreaterThanOrEqual(formWidth - 1)
      expect(toolbar?.width ?? 0).toBeGreaterThanOrEqual(formWidth - 1)
      // Not squashed: the picture keeps the phone's tall shape.
      expect(canvas.height).toBeGreaterThan(canvas.width)

      await expect(
        dialog.getByTestId('feature-request-toolbar'),
      ).toBeInViewport()
      await dialog
        .getByTestId('feature-request-submit')
        .scrollIntoViewIfNeeded()
      await expect(
        dialog.getByTestId('feature-request-submit'),
      ).toBeInViewport()
    })
  }

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
    await dialog.getByTestId('feature-request-notes').fill('Should fail')
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
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
    await dialog.getByTestId('feature-request-email').fill(EMAIL)
    await dialog.getByTestId('feature-request-submit').click()

    await expect(dialog.getByRole('alert')).toContainText(/50/)
    expect(await openedUrls(page)).toEqual([])
  })
})
