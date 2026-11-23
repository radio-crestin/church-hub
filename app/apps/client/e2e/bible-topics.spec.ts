import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Bible verses by topic (CH-203): the bundled OpenBible.info topics are there
 * on a fresh install, found by their Romanian or English title on the Bible
 * page, read in the selected translation and presented from the topic.
 */

interface Topic {
  id: number
  key: string
  titleEn: string
  titleRo: string
  referenceCount: number
}

async function topics(request: APIRequestContext): Promise<Topic[]> {
  return (await (await request.get('/api/bible/topics')).json()).data
}

async function translationId(request: APIRequestContext, language: string) {
  const all = (await (await request.get('/api/bible/translations')).json())
    .data as { id: number; language: string }[]
  const translation = all.find((t) => t.language === language)
  expect(translation, `a bundled ${language} Bible`).toBeTruthy()
  return translation!.id
}

/** The verse on the screens, as "Book chapter:verse", or null. */
async function presentedReference(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || content?.type !== 'bible') return null
  return `${content.data.bookName} ${content.data.chapter}:${content.data.currentVerseIndex + 1}`
}

async function openTopicsPanel(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('church-hub-language', 'ro')
    window.localStorage.setItem('bible:topics-open', 'true')
  })
  await page.goto('/bible')
  const panel = page.getByTestId('bible-topics-panel')
  await expect(panel).toBeVisible()
  return panel
}

test.describe('Bible topics', () => {
  // The Bible page follows the one global presentation state.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test('the bundled topics are there on a fresh install', async ({
    request,
  }) => {
    const all = await topics(request)
    expect(all.length).toBeGreaterThanOrEqual(100)
    const love = all.find((topic) => topic.key === 'gods-love')
    expect(love).toMatchObject({
      titleEn: "God's love",
      titleRo: 'Dragostea lui Dumnezeu',
    })
    expect(love!.referenceCount).toBeGreaterThanOrEqual(10)
  })

  test('the search finds a topic by its Romanian and its English title', async ({
    page,
  }) => {
    const panel = await openTopicsPanel(page)
    const search = panel.getByTestId('bible-topics-search')
    const forgiveness = panel.getByTestId('bible-topic-forgiveness')

    // Romanian, typed without diacritics
    await search.fill('iertarea')
    await expect(forgiveness).toBeVisible()
    await expect(forgiveness).toContainText('Iertarea')
    await expect(panel.getByTestId('bible-topic-prayer')).toHaveCount(0)

    // English
    await search.fill('Forgiveness')
    await expect(forgiveness).toBeVisible()
    await expect(panel.getByTestId('bible-topic-prayer')).toHaveCount(0)

    await search.fill('')
    await expect(panel.getByTestId('bible-topic-prayer')).toBeVisible()
  })

  test('a topic shows its verses in the selected translation', async ({
    page,
    request,
  }) => {
    const love = (await topics(request)).find((t) => t.key === 'gods-love')!
    const english = await translationId(request, 'en')
    const inEnglish = (
      await (
        await request.get(
          `/api/bible/topics/${love.id}?translationId=${english}`,
        )
      ).json()
    ).data
    expect(inEnglish.passages[0].reference).toBe('John 3:16')
    expect(inEnglish.passages[0].verses[0].text).toContain('For God so loved the world')

    // On the page, in its (Romanian) translation
    const panel = await openTopicsPanel(page)
    await panel.getByTestId('bible-topic-gods-love').click()
    await expect(panel.getByTestId('bible-topic-title')).toHaveText(
      'Dragostea lui Dumnezeu',
    )
    const first = panel.getByTestId('bible-topic-passage').first()
    await expect(first).toContainText('Ioan 3:16')
    await expect(first).toContainText('atât de mult a iubit Dumnezeu lumea')
    await expect(panel.getByTestId('bible-topic-passage')).toHaveCount(
      love.referenceCount,
    )
  })

  test('a verse presented from a topic is on the screen, and Next presents the following one', async ({
    page,
    request,
  }) => {
    const panel = await openTopicsPanel(page)
    await panel.getByTestId('bible-topic-gods-love').click()
    const passages = panel.getByTestId('bible-topic-passage')
    await passages.first().getByRole('button').first().click()

    await expect.poll(() => presentedReference(request)).toBe('Ioan 3:16')
    await expect(passages.first()).toHaveAttribute('data-active', 'true')
    await expect(
      page.locator('[data-testid="live-preview"]:visible').first(),
    ).toContainText('Fiindcă atât de mult a iubit Dumnezeu', {
      timeout: 15000,
    })

    await panel.getByTestId('bible-topic-next').click()
    await expect.poll(() => presentedReference(request)).toBe('Romani 5:8')
    await expect(passages.nth(1)).toHaveAttribute('data-active', 'true')

    const screens = (await (await request.get('/api/screens')).json())
      .data as { id: number; type: string }[]
    const primary = screens.find((screen) => screen.type === 'primary')
    expect(primary, 'the default primary screen').toBeTruthy()
    await page.goto(`/screen/${primary!.id}`)
    await expect(page.locator('body')).toContainText('Dumnezeu', {
      timeout: 15000,
    })
    await expect(page.locator('body')).toContainText('Romani 5:8')
  })

  test('on a phone, Teme is a tab whose verses present on tap', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      window.localStorage.setItem('church-hub-language', 'ro')
    })
    await page.goto('/bible')
    await page.getByTestId('workspace-tab-topics').click()
    const panel = page.getByTestId('bible-topics-panel')
    await panel.getByTestId('bible-topics-search').fill('rugaciune')
    await panel.getByTestId('bible-topic-prayer').click()
    await panel
      .getByTestId('bible-topic-passage')
      .first()
      .getByRole('button')
      .first()
      .click()
    await expect.poll(() => presentedReference(request)).not.toBeNull()
    await expect(page.getByTestId('bible-phone-stage')).toBeVisible()
  })
})
