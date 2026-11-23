import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The Bible page on a phone (CH-046): the preview pinned on top while the
 * chapter scrolls under it, previous / hide / next under the thumb, a
 * searched reference scrolled into view with a button to show it, and
 * Istoric, Marcaje and Programe as tabs, as on a desktop.
 */

const PHONE = { width: 390, height: 844 }

async function onPhone(page: Page) {
  await page.setViewportSize(PHONE)
  await page.addInitScript(() => {
    window.localStorage.setItem('church-hub-language', 'ro')
  })
}

/** The verse on the screens, as "Book chapter:verse", or null when hidden. */
async function presentedReference(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || content?.type !== 'bible') return null
  return `${content.data.bookName} ${content.data.chapter}:${content.data.currentVerseIndex + 1}`
}

/** The chapter's verses, apart from the same text in the preview. */
function verses(page: Page) {
  return page.getByTestId('bible-verses-scroll')
}

async function openGenesisOne(page: Page) {
  await page.goto('/bible')
  await page.getByRole('button', { name: 'Geneza', exact: true }).click()
  await page.getByRole('button', { name: '1', exact: true }).first().click()
  await expect(verses(page).getByText('La început, Dumnezeu')).toBeVisible()
}

test.describe('The Bible on a phone', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
  })

  test('the preview stays pinned and the verses are walked from the bottom bar', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await openGenesisOne(page)
    await expect(page.getByTestId('bible-phone-controls')).toBeInViewport()
    // A page of the tab bar keeps it, under its own controls; they stand in
    // for the live strip.
    await expect(page.getByTestId('mobile-tab-bar')).toBeInViewport()
    await expect(page.getByTestId('mobile-live-strip')).toBeHidden()

    await verses(page).getByText('La început, Dumnezeu').click()
    await expect.poll(() => presentedReference(request)).toBe('Geneza 1:1')

    // Scrolled deep into the chapter, the preview is still on screen, shrunk,
    // and the list stays where the finger left it.
    await verses(page).getByText('La început, Dumnezeu').hover()
    await page.mouse.wheel(0, 1500)
    await expect(
      verses(page).getByText('La început, Dumnezeu'),
    ).not.toBeInViewport()
    await expect(page.getByTestId('workspace-pinned')).toHaveAttribute(
      'data-stuck',
      'true',
    )
    const stage = page.getByTestId('bible-phone-stage')
    await expect(stage).toBeInViewport()
    await expect(stage).toContainText('La început, Dumnezeu')

    await page.getByTestId('bible-phone-next').click()
    await expect.poll(() => presentedReference(request)).toBe('Geneza 1:2')
    await page.getByTestId('bible-phone-prev').click()
    await expect.poll(() => presentedReference(request)).toBe('Geneza 1:1')

    await page.getByTestId('bible-phone-hide').click()
    await expect.poll(() => presentedReference(request)).toBeNull()
    // Hidden, the middle button shows the verse again.
    await page.getByTestId('bible-phone-project').click()
    await expect.poll(() => presentedReference(request)).toBe('Geneza 1:1')
  })

  test('a searched reference is scrolled into view and shown from the bar', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await page.goto('/bible')
    const search = page.getByPlaceholder(/Cauta|Caută/).first()
    await search.fill('Ioan 3:16')
    await search.press('Enter')

    const verse16 = verses(page).getByText(
      'Fiindcă atât de mult a iubit Dumnezeu',
    )
    await expect(verse16).toBeInViewport()
    // Not under the pinned preview and tabs either.
    const pinnedBottom = await page
      .getByTestId('workspace-pinned')
      .evaluate((el) => el.getBoundingClientRect().bottom)
    const verseTop = (await verse16.boundingBox())?.y ?? 0
    expect(verseTop).toBeGreaterThanOrEqual(pinnedBottom - 1)

    await page.getByTestId('bible-phone-project').click()
    await expect.poll(() => presentedReference(request)).toBe('Ioan 3:16')
    await expect(page.getByTestId('bible-phone-project')).toBeHidden()
  })

  test('Istoric, Marcaje and Programe are tabs, and a verse picked there opens in the Bible tab', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await openGenesisOne(page)
    await verses(page).getByText('La început, Dumnezeu').click()
    await expect.poll(() => presentedReference(request)).toBe('Geneza 1:1')

    for (const id of ['bookmarks', 'programs', 'history']) {
      await page.getByTestId(`workspace-tab-${id}`).click()
      await expect(page.getByTestId(`workspace-panel-${id}`)).toBeVisible()
      await expect(page.getByTestId('workspace-panel-navigation')).toBeHidden()
    }

    await page
      .getByTestId('workspace-panel-history')
      .getByText('Geneza 1:1')
      .first()
      .click()
    await expect(page.getByTestId('workspace-tab-navigation')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(
      verses(page).getByText('La început, Dumnezeu'),
    ).toBeInViewport()
  })

  test.describe('on a touch screen', () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

    test('keyboard hints are left out', async ({ page }) => {
      await openGenesisOne(page)
      await expect(page.locator('kbd').filter({ visible: true })).toHaveCount(0)
    })
  })

  test('a desktop keeps its columns, with no phone bar', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/bible')
    await expect(page.getByTestId('workspace-panel-history')).toBeVisible()
    await expect(page.getByTestId('workspace-panel-navigation')).toBeVisible()
    await expect(page.getByTestId('bible-phone-controls')).toHaveCount(0)
    await expect(page.getByTestId('workspace-tab-history')).toHaveCount(0)
  })
})
