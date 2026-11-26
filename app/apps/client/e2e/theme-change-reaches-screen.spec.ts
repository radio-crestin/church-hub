import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A Bible topic's template (its chip beside ▶ and 🔁) reaches the projector
 * however the topic is presented: a verse by hand, the verses stepped to from
 * it, its slideshow. Choosing another template mid-play restyles the screen
 * at once, and opening another topic mid-play moves the slideshow to it. A
 * passage may have its own template over the topic's. A topic starts with a
 * fitting built-in template, and the one chosen for it is remembered.
 */

const RED = 'rgb(255, 0, 0)'
const BLUE = 'rgb(0, 0, 255)'

interface Template {
  id: number
  bundledKey: string | null
  layouts: Record<string, Record<string, unknown>>
}

/** A copy of Classic whose every slide kind has this background colour. */
async function colourTemplate(
  request: APIRequestContext,
  name: string,
  color: string,
): Promise<number> {
  const all = (await (await request.get('/api/slide-templates')).json())
    .data as Template[]
  const classic = all.find((t) => t.bundledKey === 'classic') as Template
  const copy = (
    await (
      await request.post('/api/slide-templates', {
        data: { name, fromId: classic.id },
      })
    ).json()
  ).data as Template
  const layouts = Object.fromEntries(
    Object.entries(copy.layouts).map(([kind, layout]) => [
      kind,
      { ...layout, background: { type: 'color', color, opacity: 1 } },
    ]),
  )
  const saved = await request.put(`/api/slide-templates/${copy.id}`, {
    data: { layouts },
  })
  expect(saved.ok()).toBe(true)
  return copy.id
}

/** Whether the display draws a background of this colour. */
function drawsColour(display: Page, colour: string) {
  return display.evaluate(
    (c) =>
      [...document.querySelectorAll('div')].some(
        (el) => getComputedStyle(el).backgroundColor === c,
      ),
    colour,
  )
}

async function chooseTemplate(page: Page, templateId: number) {
  await page.getByTestId('bible-topic-template').click()
  await page.getByTestId(`template-choice-${templateId}`).click()
}

/** What is on screen: its kind, reference, template and slideshow mode. */
async function onScreen(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || !content) return null
  const { data } = content
  return {
    type: content.type as string,
    templateId: data.templateId ?? null,
    reference:
      content.type === 'bible'
        ? `${data.bookName} ${data.chapter}:${data.currentVerseIndex + 1}`
        : data.entries?.[data.currentEntryIndex]?.reference,
    slideshow: data.slideshow ?? null,
    loop: !!data.loop,
    autoAdvance: !!data.autoAdvance,
  }
}

async function topicId(request: APIRequestContext, key: string) {
  const topics = (await (await request.get('/api/bible/topics')).json())
    .data as { id: number; key: string }[]
  return topics.find((topic) => topic.key === key)?.id as number
}

test.describe("A Bible topic's template on screen", () => {
  test.describe.configure({ mode: 'serial' })

  let red: number
  let blue: number
  let projector: number
  let display: Page

  test.beforeEach(async ({ page, context, request }) => {
    await request.post('/api/presentation/clear-temporary')
    const name = `E2E Topic Theme ${Date.now()}`
    red = await colourTemplate(request, `${name} red`, '#ff0000')
    blue = await colourTemplate(request, `${name} blue`, '#0000ff')
    const screen = await request.post('/api/screens', {
      data: { name: `${name} projector`, type: 'primary' },
    })
    projector = (await screen.json()).data.id
    display = await context.newPage()
    await display.goto(`/screen/${projector}`)
    await page.addInitScript(() => {
      window.localStorage.setItem('church-hub-language', 'ro')
      window.localStorage.setItem('bible:topics-open', 'true')
    })
    await page.goto('/bible')
    await page
      .getByTestId('bible-topics-panel')
      .getByTestId('bible-topic-gods-love')
      .click()
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete(`/api/screens/${projector}`)
    await request.delete(`/api/slide-templates/${red}`)
    await request.delete(`/api/slide-templates/${blue}`)
  })

  test('a verse presented by hand, and the verses stepped to from it, use it', async ({
    page,
    request,
  }) => {
    const panel = page.getByTestId('bible-topics-panel')
    await chooseTemplate(page, red)
    await panel
      .getByTestId('bible-topic-passage')
      .first()
      .getByRole('button')
      .first()
      .click()
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ type: 'bible', reference: 'Ioan 3:16', templateId: red })
    await expect.poll(() => drawsColour(display, RED)).toBe(true)

    // The topic's next passage, then the Bible's next verse after it.
    await panel.getByTestId('bible-topic-next').click()
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ reference: 'Romani 5:8', templateId: red })
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ArrowRight')
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ reference: 'Romani 5:9', templateId: red })
    expect(await drawsColour(display, RED)).toBe(true)
  })

  test('another template chosen mid-play restyles the screen at once', async ({
    page,
    request,
  }) => {
    const panel = page.getByTestId('bible-topics-panel')
    await chooseTemplate(page, red)
    await panel.getByTestId('bible-topic-loop').click()
    await expect.poll(() => drawsColour(display, RED)).toBe(true)

    // The loop goes on where it was, now drawn with the other template.
    await chooseTemplate(page, blue)
    await expect.poll(() => drawsColour(display, BLUE)).toBe(true)
    expect(await drawsColour(display, RED)).toBe(false)
    expect(await onScreen(request)).toMatchObject({
      loop: true,
      templateId: blue,
    })

    // Stopped, the next start uses the template chosen meanwhile.
    await panel.getByTestId('bible-topic-loop').click()
    await expect.poll(() => onScreen(request)).toBeNull()
    await chooseTemplate(page, red)
    await panel.getByTestId('bible-topic-loop').click()
    await expect.poll(() => drawsColour(display, RED)).toBe(true)
    expect(await drawsColour(display, BLUE)).toBe(false)
  })

  test('another topic opened mid-play takes the slideshow over, in its mode', async ({
    page,
    request,
  }) => {
    const panel = page.getByTestId('bible-topics-panel')
    const forgiveness = await topicId(request, 'forgiveness')
    const prayer = await topicId(request, 'prayer')
    await chooseTemplate(page, red)
    await request.put(`/api/bible/topics/${forgiveness}/template`, {
      data: { templateId: blue },
    })

    // 🔁 on one topic; another opened goes on screen from its first passage,
    // drawn with its own template.
    await panel.getByTestId('bible-topic-loop').click()
    await expect.poll(async () => (await onScreen(request))?.loop).toBe(true)
    await panel.getByTestId('bible-topic-back').click()
    await panel.getByTestId('bible-topic-forgiveness').click()
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({
        slideshow: `topic:${forgiveness}`,
        loop: true,
        templateId: blue,
      })
    await expect.poll(() => drawsColour(display, BLUE)).toBe(true)

    // ▶ likewise keeps playing once through.
    await panel.getByTestId('bible-topic-loop').click()
    await panel.getByTestId('bible-topic-play').click()
    await expect
      .poll(async () => (await onScreen(request))?.autoAdvance)
      .toBe(true)
    await panel.getByTestId('bible-topic-back').click()
    await panel.getByTestId('bible-topics-search').fill('rugaciune')
    await panel.getByTestId('bible-topic-prayer').click()
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({
        slideshow: `topic:${prayer}`,
        autoAdvance: true,
        loop: false,
      })
  })

  test("a passage's own template wins over the topic's, by hand and in the slideshow", async ({
    page,
    request,
  }) => {
    const panel = page.getByTestId('bible-topics-panel')
    const love = await topicId(request, 'gods-love')
    const passages = panel.getByTestId('bible-topic-passage')
    const presentByHand = (index: number) =>
      passages.nth(index).getByRole('button').first().click()
    await chooseTemplate(page, red)

    // The second passage gets its own, from the button on its row.
    const own = panel.getByTestId('bible-topic-passage-template-1')
    await own.click()
    await page.getByTestId(`template-choice-${blue}`).click()
    await expect(own).toHaveAttribute('data-value', String(blue))
    await expect(
      panel.getByTestId('bible-topic-passage-template-0'),
    ).not.toHaveAttribute('data-value')
    await expect
      .poll(async () => {
        const topic = (
          await (await request.get(`/api/bible/topics/${love}`)).json()
        ).data
        return topic.passages[1].templateId
      })
      .toBe(blue)

    // By hand: each passage with its template.
    await presentByHand(0)
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ reference: 'Ioan 3:16', templateId: red })
    await presentByHand(1)
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ reference: 'Romani 5:8', templateId: blue })
    await expect.poll(() => drawsColour(display, BLUE)).toBe(true)

    // In the slideshow: the topic's, then the passage's own.
    await panel.getByTestId('bible-topic-loop').click()
    await expect.poll(() => drawsColour(display, RED)).toBe(true)
    await panel.getByTestId('bible-topic-next').click()
    await expect.poll(() => drawsColour(display, BLUE)).toBe(true)
    expect(await drawsColour(display, RED)).toBe(false)

    // Back to the topic's, mid-play: the screen follows.
    await own.click()
    await page.getByTestId('template-choice-none').click()
    await expect.poll(() => drawsColour(display, RED)).toBe(true)
    await expect(own).not.toHaveAttribute('data-value')
  })

  test('each topic starts with a fitting template, and the one chosen is remembered', async ({
    page,
    request,
  }) => {
    const listTopics = async () =>
      (await (await request.get('/api/bible/topics')).json()).data as {
        key: string
        templateId: number
      }[]
    const templates = (await (await request.get('/api/slide-templates')).json())
      .data as Template[]
    const bundled = new Set(
      templates.filter((t) => t.bundledKey).map((t) => t.id),
    )

    // A built-in template for every topic, the same each time, not one for all.
    const topics = await listTopics()
    expect(topics.every((topic) => bundled.has(topic.templateId))).toBe(true)
    expect(
      new Set(topics.map((topic) => topic.templateId)).size,
    ).toBeGreaterThan(2)
    expect(await listTopics()).toEqual(topics)

    // Presented by hand, a verse of the topic is drawn with it.
    const love = topics.find((topic) => topic.key === 'gods-love')
    const panel = page.getByTestId('bible-topics-panel')
    await expect(page.getByTestId('bible-topic-template')).toHaveAttribute(
      'data-value',
      String(love?.templateId),
    )
    await panel
      .getByTestId('bible-topic-passage')
      .first()
      .getByRole('button')
      .first()
      .click()
    await expect
      .poll(() => onScreen(request))
      .toMatchObject({ type: 'bible', templateId: love?.templateId })

    // Another one chosen stays the topic's, on this computer and the others.
    await chooseTemplate(page, red)
    await expect
      .poll(async () =>
        (await listTopics()).find((topic) => topic.key === 'gods-love'),
      )
      .toMatchObject({ templateId: red })
    await page.reload()
    await panel.getByTestId('bible-topic-gods-love').click()
    await expect(page.getByTestId('bible-topic-template')).toHaveAttribute(
      'data-value',
      String(red),
    )
  })
})
