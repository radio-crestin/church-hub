import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * On a program's page, a click on an item in the list picks it: Down then
 * walks that item's slides one by one, on into the next item and to the end of
 * the program; Up walks back the same way (CH-179). Before, the click only
 * opened the item and Down did nothing until a slide had been clicked.
 */

interface Program {
  scheduleId: number
  songIds: number[]
  titles: string[]
}

async function createSong(
  request: APIRequestContext,
  title: string,
  slideCount: number,
): Promise<number> {
  const res = await request.post('/api/songs', {
    data: {
      title,
      slides: Array.from({ length: slideCount }, (_, index) => ({
        content: `${title} slide ${index + 1}`,
        sortOrder: index,
      })),
    },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id
}

/**
 * song A (3) → a reading (1) → song B (2).
 * Flat steps: 0-2 song A, 3 the reading, 4-5 song B.
 */
async function createProgram(request: APIRequestContext): Promise<Program> {
  const uniq = Date.now()
  const translations = await request.get('/api/bible/translations')
  const translation = (await translations.json()).data?.[0]
  expect(translation).toBeTruthy()

  const schedule = await request.post('/api/schedules', {
    data: { title: `E2E Arrow ${uniq}` },
  })
  const scheduleId: number = (await schedule.json()).data.id

  const titles = [`E2E Arrow A ${uniq}`, `E2E Arrow B ${uniq}`]
  const songIds = [
    await createSong(request, titles[0], 3),
    await createSong(request, titles[1], 2),
  ]
  const items = [
    { songId: songIds[0] },
    {
      slideType: 'versete_tineri',
      verseteTineriEntries: [
        {
          personName: 'Timeea',
          translationId: translation.id,
          bookCode: 'PSA',
          bookName: 'Psalmii',
          startChapter: 23,
          startVerse: 1,
          endChapter: 23,
          endVerse: 2,
        },
      ],
    },
    { songId: songIds[1] },
  ]
  for (const data of items) {
    const res = await request.post(`/api/schedules/${scheduleId}/items`, {
      data,
    })
    expect(res.status()).toBe(201)
  }

  return { scheduleId, songIds, titles }
}

async function removeProgram(request: APIRequestContext, program: Program) {
  await request.post('/api/presentation/clear-temporary').catch(() => {})
  await request.delete(`/api/schedules/${program.scheduleId}`).catch(() => {})
  for (const id of program.songIds) {
    await request.delete(`/api/songs/${id}`).catch(() => {})
  }
}

/** The step of this program on the projector, or -1. */
async function liveStep(
  request: APIRequestContext,
  scheduleId: number,
): Promise<number> {
  const res = await request.get('/api/presentation/state')
  const content = (await res.json()).data?.temporaryContent
  const data = content?.data
  if (!data || data.scheduleId !== scheduleId) return -1
  return data.scheduleItemIndex ?? -1
}

async function expectLive(
  page: Page,
  request: APIRequestContext,
  program: Program,
  step: number,
): Promise<void> {
  await expect
    .poll(() => liveStep(request, program.scheduleId), { timeout: 10000 })
    .toBe(step)
  await expect(page.getByTestId(`schedule-sub-item-${step}`)).toHaveClass(
    /ring-live/,
    { timeout: 10000 },
  )
}

function itemRow(page: Page, title: string) {
  return page.getByTestId('schedule-item').filter({ hasText: title })
}

test.describe('Down/Up walk a program from the item clicked in the list', () => {
  test('Down goes through every slide, into the next items, to the end; Up comes back', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/clear-temporary')
    const program = await createProgram(request)
    try {
      await page.goto(`/schedules/${program.scheduleId}`)
      await page.waitForLoadState('networkidle')

      await itemRow(page, program.titles[0])
        .getByText(program.titles[0])
        .click()
      await expect(itemRow(page, program.titles[0])).toHaveAttribute(
        'data-selected',
        'true',
      )
      // Picking an item puts nothing on the projector by itself.
      expect(await liveStep(request, program.scheduleId)).toBe(-1)

      for (let step = 0; step <= 5; step++) {
        await page.keyboard.press('ArrowDown')
        await expectLive(page, request, program, step)
      }
      await expect(itemRow(page, program.titles[0])).not.toHaveAttribute(
        'data-selected',
      )

      for (let step = 4; step >= 0; step--) {
        await page.keyboard.press('ArrowUp')
        await expectLive(page, request, program, step)
      }
    } finally {
      await removeProgram(request, program)
    }
  })

  test('an item clicked while another one is live is where Down and Up go next', async ({
    page,
    request,
  }) => {
    const program = await createProgram(request)
    try {
      await page.goto(`/schedules/${program.scheduleId}`)
      await page.waitForLoadState('networkidle')

      // Song B's first slide is up; the operator goes back to song A.
      await itemRow(page, program.titles[1])
        .getByText(program.titles[1])
        .click()
      await page.keyboard.press('ArrowDown')
      await expectLive(page, request, program, 4)

      await itemRow(page, program.titles[0])
        .getByText(program.titles[0])
        .click()
      await page.keyboard.press('ArrowDown')
      await expectLive(page, request, program, 0)

      // Up right after a click goes to the step just before the item: the
      // reading's last entry before song B.
      await itemRow(page, program.titles[1])
        .getByText(program.titles[1])
        .click()
      await page.keyboard.press('ArrowUp')
      await expectLive(page, request, program, 3)
    } finally {
      await removeProgram(request, program)
    }
  })
})
