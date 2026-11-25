import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * CH-184, review: templates are themes, edited like a PowerPoint
 * presentation (every slide type as a slide, and a Design tab that changes
 * every slide at once); a display shows its theme as its slides; and each
 * presentation has its own theme, changed for it only.
 */

interface Template {
  id: number
  bundledKey: string | null
  scheduleId: number | null
  layouts: Record<
    string,
    {
      mainText?: { style: { color: string } }
      contentText?: { style: { color: string } }
    }
  >
}

const SLIDE_TYPES = [
  'song',
  'song_first_slide',
  'song_last_slide',
  'bible',
  'bible_passage',
  'versete_tineri',
  'announcement',
  'empty',
]

async function bundled(request: APIRequestContext, key: string) {
  const all = (await (await request.get('/api/slide-templates')).json())
    .data as Template[]
  return all.find((template) => template.bundledKey === key) as Template
}

async function template(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/slide-templates/${id}`)
  return response.ok() ? ((await response.json()).data as Template) : null
}

async function createSchedule(request: APIRequestContext, title: string) {
  const response = await request.post('/api/schedules', { data: { title } })
  return (await response.json()).data.id as number
}

async function scheduleThemeId(request: APIRequestContext, id: number) {
  return (await (await request.get(`/api/schedules/${id}`)).json()).data
    .templateId as number | null
}

test.describe('Themes', () => {
  test('a display shows its theme as its slides, and one opens in the editor', async ({
    page,
    request,
  }) => {
    const response = await request.post('/api/screens', {
      data: { name: `E2E Theme Slides ${Date.now()}`, type: 'primary' },
    })
    const screenId = (await response.json()).data.id as number
    try {
      await page.goto(`/settings/screens?screen=${screenId}`)
      const slides = page.getByTestId('screen-theme-slides')
      for (const type of SLIDE_TYPES) {
        await expect(slides.getByTestId(`screen-slide-${type}`)).toBeVisible()
      }

      // A slide opens the editor on it, with every slide in a list.
      await slides.getByTestId('screen-slide-bible').click()
      await expect(
        page.getByTestId('screen-editor-slide-bible'),
      ).toHaveAttribute('aria-pressed', 'true')
      for (const type of SLIDE_TYPES) {
        await expect(
          page.getByTestId(`screen-editor-slide-${type}`),
        ).toBeVisible()
      }
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })

  test('a presentation has its own theme, and its Design changes every slide of it only', async ({
    page,
    request,
  }) => {
    const title = `E2E Own Theme ${Date.now()}`
    const scheduleId = await createSchedule(request, title)
    const classic = await bundled(request, 'classic')
    try {
      // Choosing a theme gives the presentation its own copy of it.
      expect(
        (
          await request.put(`/api/schedules/${scheduleId}/template`, {
            data: { templateId: classic.id },
          })
        ).ok(),
      ).toBe(true)
      const ownId = (await scheduleThemeId(request, scheduleId)) as number
      expect(ownId).not.toBe(classic.id)
      expect((await template(request, ownId))?.scheduleId).toBe(scheduleId)
      // Not among the shared themes.
      const shared = (await (await request.get('/api/slide-templates')).json())
        .data as Template[]
      expect(shared.some((theme) => theme.id === ownId)).toBe(false)
      // An item can't borrow another presentation's own theme.
      const item = await request.post(`/api/schedules/${scheduleId}/items`, {
        data: { slideType: 'announcement', slideContent: '<p>Bun venit</p>' },
      })
      const itemId = (await item.json()).data.id as number
      expect(
        (
          await request.put(
            `/api/schedules/${scheduleId}/items/${itemId}/template`,
            { data: { templateId: ownId } },
          )
        ).status(),
      ).toBeGreaterThanOrEqual(400)

      // Edit theme → Design: the text colour of every slide, saved.
      await page.goto(`/schedules/${scheduleId}`)
      await page.getByTestId('schedule-edit-theme').click()
      await page.getByTestId('screen-editor-tab-design').click()
      await page
        .getByTestId('theme-design-text-color')
        .evaluate((input: HTMLInputElement) => {
          const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )?.set
          setValue?.call(input, '#ff8800')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        })
      await page.getByTestId('screen-editor-save').click()
      await expect
        .poll(async () => {
          const own = await template(request, ownId)
          return [
            own?.layouts.song?.mainText?.style.color,
            own?.layouts.announcement?.mainText?.style.color,
            own?.layouts.bible?.contentText?.style.color,
          ]
        })
        .toEqual(['#ff8800', '#ff8800', '#ff8800'])
      // The built-in theme it came from is as it was.
      expect(
        (await template(request, classic.id))?.layouts.song?.mainText?.style
          .color,
      ).not.toBe('#ff8800')

      // Its own theme goes with it.
      await request.delete(`/api/schedules/${scheduleId}`)
      expect(await template(request, ownId)).toBeNull()
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`)
    }
  })
})
