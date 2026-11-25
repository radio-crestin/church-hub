import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * CH-184: a presentation picks one template for all its slides, an item may
 * have its own, and a topic's verse loop its own. The projector (it follows
 * presentations) draws them with it; the stage monitor keeps its own design.
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
  expect(
    (
      await request.put(`/api/slide-templates/${copy.id}`, {
        data: { layouts },
      })
    ).ok(),
  ).toBe(true)
  return copy.id
}

async function createScreen(
  request: APIRequestContext,
  name: string,
  type: 'primary' | 'stage',
): Promise<number> {
  const res = await request.post('/api/screens', { data: { name, type } })
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

test.describe('Templates in presentations', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
  })

  test('a presentation and one of its items draw with their templates', async ({
    page,
    context,
    request,
  }) => {
    const name = `E2E Tpl Presentation ${Date.now()}`
    const red = await colourTemplate(request, `${name} red`, '#ff0000')
    const blue = await colourTemplate(request, `${name} blue`, '#0000ff')
    const projector = await createScreen(
      request,
      `${name} projector`,
      'primary',
    )
    const stage = await createScreen(request, `${name} stage`, 'stage')
    const schedule = (
      await (
        await request.post('/api/schedules', { data: { title: name } })
      ).json()
    ).data as { id: number }
    const itemIds: number[] = []
    for (const text of ['Bun venit!', 'Anunțuri']) {
      const item = await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: `<p>${text}</p>` },
      })
      itemIds.push((await item.json()).data.id)
    }

    try {
      // One choice in the presentation's header.
      await page.goto(`/schedules/${schedule.id}`)
      await page.getByTestId('schedule-template-picker').click()
      await page.getByTestId(`template-choice-${red}`).click()
      await expect
        .poll(
          async () =>
            (await (await request.get(`/api/schedules/${schedule.id}`)).json())
              .data.templateId,
        )
        .toBe(red)

      // The second item gets its own, from the chip beside it.
      await page.getByTestId(`schedule-item-template-${itemIds[1]}`).click()
      await page.getByTestId(`template-choice-${blue}`).click()
      await expect
        .poll(async () => {
          const items = (
            await (await request.get(`/api/schedules/${schedule.id}`)).json()
          ).data.items as { id: number; templateId: number | null }[]
          return items.find((item) => item.id === itemIds[1])?.templateId
        })
        .toBe(blue)

      const projectorPage = await context.newPage()
      await projectorPage.goto(`/screen/${projector}`)
      const stagePage = await context.newPage()
      await stagePage.goto(`/screen/${stage}`)

      // First item: the presentation's template, on the projector only.
      expect(
        (await request.post(`/api/schedules/${schedule.id}/run`)).ok(),
      ).toBe(true)
      await expect.poll(() => drawsColour(projectorPage, RED)).toBe(true)
      await expect(stagePage.getByText('Bun venit!').last()).toBeVisible()
      expect(await drawsColour(stagePage, RED)).toBe(false)

      // Second item, as its row presents it: its own template.
      await request.post('/api/schedules/automation/stop')
      await request.post('/api/presentation/temporary-announcement', {
        data: {
          content: '<p>Anunțuri</p>',
          scheduleId: schedule.id,
          scheduleItemIndex: 1,
        },
      })
      await expect.poll(() => drawsColour(projectorPage, BLUE)).toBe(true)

      // A projector that doesn't follow presentations keeps its own design.
      await request.post('/api/screens', {
        data: {
          id: projector,
          name: `${name} projector`,
          type: 'primary',
          followsPresentation: false,
        },
      })
      await expect.poll(() => drawsColour(projectorPage, BLUE)).toBe(false)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
      await request.delete(`/api/screens/${projector}`)
      await request.delete(`/api/screens/${stage}`)
      await request.delete(`/api/slide-templates/${red}`)
      await request.delete(`/api/slide-templates/${blue}`)
    }
  })

  test("on a phone the presentation's template is chosen from its menu", async ({
    page,
    request,
  }) => {
    const name = `E2E Tpl Phone ${Date.now()}`
    const red = await colourTemplate(request, `${name} red`, '#ff0000')
    const schedule = (
      await (
        await request.post('/api/schedules', { data: { title: name } })
      ).json()
    ).data as { id: number }
    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/schedules/${schedule.id}`)
      // The header leaves the name its room: no picker beside it.
      await expect(page.getByTestId('schedule-title-edit')).toBeVisible()
      await expect(page.getByTestId('schedule-template-picker')).toHaveCount(0)

      await page.getByTestId('schedule-presenter-actions-menu').click()
      await page.getByTestId('schedule-template-action').click()
      await page.getByTestId(`template-choice-${red}`).click()
      await expect
        .poll(
          async () =>
            (await (await request.get(`/api/schedules/${schedule.id}`)).json())
              .data.templateId,
        )
        .toBe(red)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
      await request.delete(`/api/slide-templates/${red}`)
    }
  })

  test("a topic's verse loop draws with the template chosen for it", async ({
    context,
    request,
  }) => {
    const name = `E2E Tpl Topic ${Date.now()}`
    const red = await colourTemplate(request, `${name} red`, '#ff0000')
    const projector = await createScreen(
      request,
      `${name} projector`,
      'primary',
    )
    try {
      const display = await context.newPage()
      await display.goto(`/screen/${projector}`)
      const presented = await request.post(
        '/api/presentation/temporary-versete-tineri',
        {
          data: {
            entries: [
              {
                id: 1,
                personName: '',
                translationId: 1,
                bookCode: 'JHN',
                bookName: 'Ioan',
                reference: 'Ioan 3:16',
                text: 'Fiindcă atât de mult a iubit Dumnezeu lumea',
                startChapter: 3,
                startVerse: 16,
                endChapter: 3,
                endVerse: 16,
                sortOrder: 0,
              },
            ],
            currentEntryIndex: 0,
            loop: true,
            slideshow: 'topic:1',
            templateId: red,
          },
        },
      )
      expect(presented.ok()).toBe(true)
      await expect.poll(() => drawsColour(display, RED)).toBe(true)
    } finally {
      await request.delete(`/api/screens/${projector}`)
      await request.post('/api/presentation/clear-temporary')
      await request.delete(`/api/slide-templates/${red}`)
    }
  })
})
