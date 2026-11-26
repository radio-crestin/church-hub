import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A theme chosen for what is on screen restyles the projector at once, and
 * the next time it is presented otherwise: a Bible topic's verse loop (its
 * template chip beside ▶ and 🔁) and a presentation (its header). The topic
 * loop's theme reached the screens only when the loop was started.
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

async function createProjector(
  request: APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/screens', {
    data: { name, type: 'primary' },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()).data.id
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

async function chooseTemplate(page: Page, picker: string, templateId: number) {
  await page.getByTestId(picker).click()
  await page.getByTestId(`template-choice-${templateId}`).click()
}

/** The verse loop on screen: which verse, and whether it still loops. */
async function loopOnScreen(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || content?.type !== 'versete_tineri') return null
  return { index: content.data.currentEntryIndex, loop: content.data.loop }
}

test.describe('Changing the theme of what is on screen', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
  })

  test("a Bible topic's verse loop restyles live, and the next time", async ({
    page,
    context,
    request,
  }) => {
    const name = `E2E Topic Theme ${Date.now()}`
    const red = await colourTemplate(request, `${name} red`, '#ff0000')
    const blue = await colourTemplate(request, `${name} blue`, '#0000ff')
    const projector = await createProjector(request, `${name} projector`)
    try {
      const display = await context.newPage()
      await display.goto(`/screen/${projector}`)
      await page.addInitScript(() => {
        window.localStorage.setItem('bible:topics-open', 'true')
      })
      await page.goto('/bible')
      const panel = page.getByTestId('bible-topics-panel')
      await panel.getByTestId('bible-topic-gods-love').click()

      await chooseTemplate(page, 'bible-topic-template', red)
      await panel.getByTestId('bible-topic-loop').click()
      await expect.poll(() => drawsColour(display, RED)).toBe(true)

      // Live: the screen restyles at once, the loop goes on where it was.
      const before = await loopOnScreen(request)
      await chooseTemplate(page, 'bible-topic-template', blue)
      await expect.poll(() => drawsColour(display, BLUE)).toBe(true)
      expect(await drawsColour(display, RED)).toBe(false)
      const after = await loopOnScreen(request)
      expect(after?.loop).toBe(true)
      expect(after?.index).toBeGreaterThanOrEqual(before?.index ?? 0)

      // Not live: the next loop is drawn with the theme chosen meanwhile.
      await panel.getByTestId('bible-topic-loop').click()
      await expect.poll(() => loopOnScreen(request)).toBeNull()
      await chooseTemplate(page, 'bible-topic-template', red)
      await expect.poll(() => loopOnScreen(request)).toBeNull()
      await panel.getByTestId('bible-topic-loop').click()
      await expect.poll(() => drawsColour(display, RED)).toBe(true)
      expect(await drawsColour(display, BLUE)).toBe(false)
    } finally {
      await request.delete(`/api/screens/${projector}`)
      await request.delete(`/api/slide-templates/${red}`)
      await request.delete(`/api/slide-templates/${blue}`)
    }
  })

  test('a presentation restyles live, and the next time', async ({
    page,
    context,
    request,
  }) => {
    const name = `E2E Presentation Theme ${Date.now()}`
    const red = await colourTemplate(request, `${name} red`, '#ff0000')
    const blue = await colourTemplate(request, `${name} blue`, '#0000ff')
    const projector = await createProjector(request, `${name} projector`)
    const schedule = (
      await (
        await request.post('/api/schedules', { data: { title: name } })
      ).json()
    ).data as { id: number }
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'announcement', slideContent: '<p>Bun venit!</p>' },
    })
    const run = async () =>
      expect(
        (await request.post(`/api/schedules/${schedule.id}/run`)).ok(),
      ).toBe(true)

    try {
      await page.goto(`/schedules/${schedule.id}`)
      await chooseTemplate(page, 'schedule-template-picker', red)
      const display = await context.newPage()
      await display.goto(`/screen/${projector}`)

      // Live: the screen restyles as soon as another theme is chosen.
      await run()
      await expect.poll(() => drawsColour(display, RED)).toBe(true)
      await chooseTemplate(page, 'schedule-template-picker', blue)
      await expect.poll(() => drawsColour(display, BLUE)).toBe(true)
      expect(await drawsColour(display, RED)).toBe(false)

      // Not live: presenting it again uses the theme chosen meanwhile.
      await request.post('/api/schedules/automation/stop')
      await request.post('/api/presentation/clear-temporary')
      const ownTheme = async () =>
        (await (await request.get(`/api/schedules/${schedule.id}`)).json()).data
          .templateId
      const blueCopy = await ownTheme()
      await chooseTemplate(page, 'schedule-template-picker', red)
      await expect.poll(ownTheme).not.toBe(blueCopy)
      await run()
      await expect.poll(() => drawsColour(display, RED)).toBe(true)
      expect(await drawsColour(display, BLUE)).toBe(false)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
      await request.delete(`/api/screens/${projector}`)
      await request.delete(`/api/slide-templates/${red}`)
      await request.delete(`/api/slide-templates/${blue}`)
    }
  })
})
