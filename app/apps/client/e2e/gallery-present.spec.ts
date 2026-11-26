import fs from 'node:fs'
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import {
  deleteUploadedMedia,
  label,
  PNG,
  uploadMedia,
  WEBM_FIXTURE,
} from './helpers/background-media'

/**
 * A gallery file goes on the screens on its own: the card's present button, a
 * double-click on the card or the preview's Present button. An image shows
 * full screen (temporary content `image`), a video plays (`video`); the card
 * on the screens is marked live, and Hide (Esc) takes it off.
 */

async function presentationState(request: APIRequestContext) {
  const res = await request.get('/api/presentation/state')
  return (await res.json()).data
}

function galleryItem(page: Page, id: string) {
  return page.locator(`[data-testid="gallery-item"][data-media-id="${id}"]`)
}

function thumbnail(page: Page, id: string) {
  return galleryItem(page, id).getByRole('button', {
    name: label('gallery', 'item.preview'),
  })
}

async function openGallery(page: Page) {
  await page.goto('/gallery')
  await expect(page.getByTestId('gallery-page')).toBeVisible({
    timeout: 15000,
  })
}

test.describe('Present from the gallery', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await deleteUploadedMedia(request)
  })

  test("a card's present button shows the image full screen and marks the card live; Esc hides it", async ({
    page,
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'present.png')
    await openGallery(page)
    const card = galleryItem(page, image.id)
    await expect(card).not.toHaveAttribute('data-live')

    await card.hover()
    await card.getByTestId('gallery-item-present').click()

    await expect
      .poll(async () => presentationState(request))
      .toMatchObject({
        isHidden: false,
        isPresenting: true,
        temporaryContent: {
          type: 'image',
          data: { mediaId: image.id, url: image.url },
        },
      })
    await expect(card).toHaveAttribute('data-live', 'true')
    // No preview opened by the button.
    await expect(page.getByTestId('gallery-preview-modal')).toBeHidden()

    // Next does nothing special for a single image: it stays up.
    await page.keyboard.press('ArrowRight')
    await expect(card).toHaveAttribute('data-live', 'true')
    expect((await presentationState(request)).temporaryContent).toMatchObject({
      type: 'image',
      data: { mediaId: image.id },
    })

    await page.keyboard.press('Escape')
    await expect
      .poll(async () => (await presentationState(request)).isHidden)
      .toBe(true)
    await expect(card).not.toHaveAttribute('data-live')
  })

  test('the projection draws the image fit on black', async ({
    page,
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'screen.png')
    const { data: screens } = await (await request.get('/api/screens')).json()
    const screen = screens[0] as { id: number }

    const res = await request.post('/api/presentation/temporary-image', {
      data: { mediaId: image.id },
    })
    expect(res.status()).toBe(200)
    await page.goto(`/screen/${screen.id}`)

    const shown = page.getByTestId('screen-image')
    await expect(shown).toBeVisible({ timeout: 15000 })
    await expect(shown).toHaveAttribute('src', new RegExp(`${image.url}$`))
    await expect(shown).toHaveCSS('object-fit', 'contain')
    await expect(shown).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    await expect(shown).toHaveCSS('opacity', '1')

    // Hiding fades it out and takes it off.
    await request.post('/api/presentation/clear')
    await expect(page.getByTestId('screen-image')).toHaveCount(0)
  })

  test('a double-click on a video card plays it on the screens', async ({
    page,
    request,
  }) => {
    const video = await uploadMedia(
      request,
      fs.readFileSync(WEBM_FIXTURE),
      'video/webm',
      'present.webm',
    )
    await openGallery(page)

    await thumbnail(page, video.id).dblclick()

    await expect
      .poll(async () => (await presentationState(request)).temporaryContent)
      .toMatchObject({
        type: 'video',
        data: { mediaId: video.id, url: video.url },
      })
    await expect(galleryItem(page, video.id)).toHaveAttribute(
      'data-live',
      'true',
    )
    // A double-click presents only: the preview stays closed.
    await page.waitForTimeout(400)
    await expect(page.getByTestId('gallery-preview-modal')).toBeHidden()

    // A single click still opens the preview.
    await thumbnail(page, video.id).click()
    await expect(page.getByTestId('gallery-preview-modal')).toBeVisible()
  })

  test("the preview's Present button presents the file and closes the preview", async ({
    page,
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'modal.png')
    await openGallery(page)

    await thumbnail(page, image.id).click()
    const modal = page.getByTestId('gallery-preview-modal')
    await expect(modal).toBeVisible()
    await modal.getByTestId('gallery-preview-present').click()

    await expect(modal).toBeHidden()
    await expect
      .poll(async () => (await presentationState(request)).temporaryContent)
      .toMatchObject({ type: 'image', data: { mediaId: image.id } })
    await expect(galleryItem(page, image.id)).toHaveAttribute(
      'data-live',
      'true',
    )
  })
})
