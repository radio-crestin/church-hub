import fs from 'node:fs'
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import {
  type BackgroundMedia,
  deleteMediaExcept,
  label,
  listMedia,
  listMediaIds,
  message,
  PNG,
  uploadMedia,
  WEBM_FIXTURE,
} from './helpers/background-media'

/**
 * The gallery lists every uploaded background image and video: several files
 * upload at once (a refused one gets its own error and the rest carry on),
 * tabs filter by kind, an item opens at full size, and it can be deleted.
 */

type Kind = BackgroundMedia['kind']

const FILTER_TEST_IDS = {
  all: 'gallery-filter-all',
  image: 'gallery-filter-images',
  video: 'gallery-filter-videos',
} as const

function galleryItem(page: Page, id: string) {
  return page.locator(`[data-testid="gallery-item"][data-media-id="${id}"]`)
}

/** Clicks a filter tab and checks it is the only one pressed. */
async function filterBy(page: Page, filter: keyof typeof FILTER_TEST_IDS) {
  await page.getByTestId(FILTER_TEST_IDS[filter]).click()
  for (const [value, testId] of Object.entries(FILTER_TEST_IDS)) {
    await expect(page.getByTestId(testId)).toHaveAttribute(
      'aria-pressed',
      String(value === filter),
    )
  }
}

async function countOfKind(request: APIRequestContext, kind: Kind) {
  return (await listMedia(request)).filter((item) => item.kind === kind).length
}

async function openGallery(page: Page) {
  await page.goto('/gallery')
  await expect(page.getByTestId('gallery-page')).toBeVisible({
    timeout: 15000,
  })
}

test.describe('Gallery', () => {
  let preexistingMediaIds = new Set<string>()

  test.beforeAll(async ({ request }) => {
    preexistingMediaIds = new Set(await listMediaIds(request))
  })

  test.afterEach(async ({ request }) => {
    await deleteMediaExcept(request, preexistingMediaIds)
  })

  test('the sidebar opens the gallery, which uploads several files at once and filters them by kind', async ({
    page,
    request,
  }) => {
    const suffix = Date.now()
    const imageName = `e2e-gallery-${suffix}.png`
    const videoName = `e2e-gallery-${suffix}.webm`
    const textName = `e2e-gallery-${suffix}.txt`
    const before = new Set(await listMediaIds(request))

    await page.goto('/')
    await page
      .locator('a[href="/gallery"]')
      .filter({ visible: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/gallery$/)
    await expect(page.getByTestId('gallery-page')).toBeVisible()
    await expect(page.getByTestId('gallery-filter-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    if (before.size === 0) {
      await expect(
        page
          .getByTestId('gallery-empty')
          .getByText(label('gallery', 'empty.all')),
      ).toBeVisible()
    }

    // One pick: an image, a text file and a video.
    await page.getByTestId('gallery-upload-input').setInputFiles([
      { name: imageName, mimeType: 'image/png', buffer: PNG },
      {
        name: textName,
        mimeType: 'text/plain',
        buffer: Buffer.from('not an image'),
      },
      {
        name: videoName,
        mimeType: 'video/webm',
        buffer: fs.readFileSync(WEBM_FIXTURE),
      },
    ])

    // The text file is refused on its own; the other two still upload.
    await expect(
      page.getByText(
        message('gallery', 'upload.errors.unsupportedType', () => ({
          name: textName,
        })),
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        message(
          'gallery',
          (lng) => `upload.success_${new Intl.PluralRules(lng).select(2)}`,
          () => ({ count: 2 }),
        ),
      ),
    ).toBeVisible({ timeout: 15000 })

    let uploads: BackgroundMedia[] = []
    await expect
      .poll(async () => {
        uploads = (await listMedia(request)).filter(
          (item) => !before.has(item.id),
        )
        return uploads.map((item) => item.kind).sort()
      })
      .toEqual(['image', 'video'])
    const image = uploads.find(
      (item) => item.kind === 'image',
    ) as BackgroundMedia
    const video = uploads.find(
      (item) => item.kind === 'video',
    ) as BackgroundMedia
    expect(image.mimeType).toBe('image/png')
    expect(video.mimeType).toBe('video/webm')
    await expect(galleryItem(page, image.id)).toHaveAttribute(
      'data-kind',
      'image',
    )
    await expect(galleryItem(page, video.id)).toHaveAttribute(
      'data-kind',
      'video',
    )
    // Nothing was stored for the text file.
    expect(await listMediaIds(request)).toHaveLength(before.size + 2)

    const items = page.getByTestId('gallery-item')
    const itemsOfKind = (kind: Kind) =>
      page.locator(`[data-testid="gallery-item"][data-kind="${kind}"]`)

    await filterBy(page, 'image')
    await expect(galleryItem(page, image.id)).toBeVisible()
    await expect(galleryItem(page, video.id)).toHaveCount(0)
    await expect(itemsOfKind('video')).toHaveCount(0)
    await expect(items).toHaveCount(await countOfKind(request, 'image'))

    await filterBy(page, 'video')
    await expect(galleryItem(page, video.id)).toBeVisible()
    await expect(galleryItem(page, image.id)).toHaveCount(0)
    await expect(itemsOfKind('image')).toHaveCount(0)
    await expect(items).toHaveCount(await countOfKind(request, 'video'))

    await filterBy(page, 'all')
    await expect(galleryItem(page, image.id)).toBeVisible()
    await expect(galleryItem(page, video.id)).toBeVisible()
    await expect(items).toHaveCount(before.size + 2)
  })

  test('an item opens at full size and Esc closes it', async ({
    page,
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'preview.png')
    const video = await uploadMedia(
      request,
      fs.readFileSync(WEBM_FIXTURE),
      'video/webm',
      'preview.webm',
    )
    await openGallery(page)

    const modal = page.getByTestId('gallery-preview-modal')
    const previewButton = (id: string) =>
      galleryItem(page, id).getByRole('button', {
        name: label('gallery', 'item.preview'),
      })

    await previewButton(image.id).click()
    await expect(modal).toBeVisible()
    await expect(modal.locator('img')).toHaveAttribute(
      'src',
      new RegExp(`${image.url}$`),
    )
    await expect(modal.locator('video')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()

    await previewButton(video.id).click()
    await expect(modal).toBeVisible()
    const player = modal.locator('video')
    await expect(player).toHaveAttribute('src', new RegExp(`${video.url}$`))
    await expect(modal.locator('img')).toHaveCount(0)
    // It really loads (a VP8 WebM Chromium can decode).
    await expect
      .poll(
        () => player.evaluate((el) => (el as HTMLVideoElement).readyState),
        {
          timeout: 10000,
        },
      )
      .toBeGreaterThanOrEqual(2)
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()

    // The close button works too.
    await previewButton(image.id).click()
    await expect(modal).toBeVisible()
    await page.getByTestId('gallery-preview-close').click()
    await expect(modal).toBeHidden()
  })

  test('deleting an item removes it, and a kind with none shows the empty state', async ({
    page,
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'delete-me.png')
    await openGallery(page)
    await expect(galleryItem(page, image.id)).toBeVisible()

    // No uploaded video: the Videos tab says so.
    if ((await countOfKind(request, 'video')) === 0) {
      await filterBy(page, 'video')
      await expect(
        page
          .getByTestId('gallery-empty')
          .getByText(label('gallery', 'empty.video')),
      ).toBeVisible()
      await expect(page.getByTestId('gallery-item')).toHaveCount(0)
      await filterBy(page, 'all')
    }

    await galleryItem(page, image.id).getByTestId('gallery-item-delete').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog.getByRole('heading')).toHaveText(
      label('gallery', 'delete.confirmTitle'),
    )
    const deleteResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/media/backgrounds/${image.id}`) &&
        res.request().method() === 'DELETE',
    )
    await dialog.getByRole('button').last().click()
    expect((await deleteResponse).status()).toBe(200)

    await expect(dialog).toHaveCount(0)
    await expect(galleryItem(page, image.id)).toHaveCount(0)
    expect(await listMediaIds(request)).not.toContain(image.id)
    if ((await listMediaIds(request)).length === 0) {
      await expect(page.getByTestId('gallery-empty')).toBeVisible()
    }
  })

  test('fits a phone screen without scrolling sideways', async ({
    page,
    request,
  }) => {
    await uploadMedia(request, PNG, 'image/png', 'phone.png')
    await uploadMedia(
      request,
      fs.readFileSync(WEBM_FIXTURE),
      'video/webm',
      'phone.webm',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await openGallery(page)
    await expect(page.getByTestId('gallery-item').first()).toBeVisible()

    const overflow = await page.evaluate(() => {
      const galleryPage = document.querySelector(
        '[data-testid="gallery-page"]',
      ) as HTMLElement
      return {
        document:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        gallery: galleryPage.scrollWidth - galleryPage.clientWidth,
      }
    })
    expect(overflow).toEqual({ document: 0, gallery: 0 })

    // The controls sit inside the viewport.
    for (const testId of [
      'gallery-upload-button',
      'gallery-filter-all',
      'gallery-filter-videos',
    ]) {
      const box = await page.getByTestId(testId).boundingBox()
      expect(box, testId).not.toBeNull()
      expect(box?.x ?? -1, testId).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0), testId).toBeLessThanOrEqual(390)
    }
  })
})
