import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

/**
 * The program page keeps the step on the projector in view while a service
 * runs — including the jump from a Bible reading into the song after it, where
 * the reading collapses and the song opens at the same moment (reported twice
 * by BCEV: the list stayed on the old spot and the live verse was off screen).
 */

const LYRICS = [
  'Să ai pace în mijlocul necazului tău.',
  'Să ai pace că tu eşti fiu de Dumnezeu.',
  'Când cei din jur te vor privi.',
  'Cu pacea ta îi vei uimi.',
  'Fiind plin de pace vei birui.',
].join('\n')

interface Program {
  scheduleId: number
  songIds: number[]
  /** How many presentable steps the program has, in order. */
  stepCount: number
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
        content: `${index + 1}. ${LYRICS}`,
        sortOrder: index,
      })),
    },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id
}

/**
 * song A (4) → four people's readings → song B (8) → a reading → song C (4).
 * Flat steps: 0-3 song A, 4-7 the readings, 8-15 song B, 16 the reading,
 * 17-20 song C.
 */
async function createProgram(request: APIRequestContext): Promise<Program> {
  const uniq = Date.now()
  const translations = await request.get('/api/bible/translations')
  const translation = (await translations.json()).data?.[0]
  expect(translation).toBeTruthy()

  const schedule = await request.post('/api/schedules', {
    data: { title: `E2E Follow ${uniq}` },
  })
  const scheduleId: number = (await schedule.json()).data.id

  const passage = (startVerse: number, endVerse: number) => ({
    translationId: translation.id,
    bookCode: 'PSA',
    bookName: 'Psalmii',
    startChapter: 34,
    startVerse,
    endChapter: 34,
    endVerse,
  })
  const songIds = [
    await createSong(request, `E2E Follow A ${uniq}`, 4),
    await createSong(request, `E2E Follow B ${uniq}`, 8),
    await createSong(request, `E2E Follow C ${uniq}`, 4),
  ]
  const items = [
    { songId: songIds[0] },
    {
      slideType: 'versete_tineri',
      verseteTineriEntries: ['Timeea', 'Tibi', 'Ana', 'Ion'].map(
        (personName, index) => ({
          personName,
          ...passage(index * 4 + 1, index * 4 + 4),
        }),
      ),
    },
    { songId: songIds[1] },
    {
      biblePassage: {
        ...passage(20, 22),
        translationAbbreviation: translation.abbreviation,
      },
    },
    { songId: songIds[2] },
  ]
  for (const data of items) {
    const res = await request.post(`/api/schedules/${scheduleId}/items`, {
      data,
    })
    expect(res.status()).toBe(201)
  }

  return { scheduleId, songIds, stepCount: 21 }
}

async function removeProgram(request: APIRequestContext, program: Program) {
  await request.post('/api/presentation/clear-temporary').catch(() => {})
  await request.delete(`/api/schedules/${program.scheduleId}`).catch(() => {})
  for (const id of program.songIds) {
    await request.delete(`/api/songs/${id}`).catch(() => {})
  }
}

/** The live row is fully on screen, near the top of the list. */
async function expectFollowed(page: Page, step: number): Promise<void> {
  const live: Locator = page.getByTestId(`schedule-sub-item-${step}`)
  await expect(live).toHaveClass(/ring-green-500/, { timeout: 10000 })
  await expect(live).toBeInViewport({ ratio: 1, timeout: 5000 })
}

test.describe('the program page follows the live step', () => {
  test.beforeEach(async ({ page }) => {
    // Short enough that song B's slides do not fit without scrolling.
    await page.setViewportSize({ width: 1400, height: 720 })
  })

  for (const advance of ['Next button', 'Right arrow'] as const) {
    test(`walking a program with the ${advance} keeps every step in view, reading → song too`, async ({
      page,
      request,
    }) => {
      const program = await createProgram(request)
      try {
        await page.goto(`/schedules/${program.scheduleId}`)
        await page.waitForLoadState('networkidle')

        // Start on the readings, the way a service reaches them.
        await page.getByText('Timeea', { exact: false }).first().click()
        await page.getByTestId('schedule-sub-item-4').click()
        await expectFollowed(page, 4)

        for (let step = 5; step < program.stepCount; step++) {
          if (advance === 'Next button') {
            await page.getByTestId('schedule-preview-next').click()
          } else {
            await page.keyboard.press('ArrowRight')
          }
          await expectFollowed(page, step)
        }
      } finally {
        await removeProgram(request, program)
      }
    })
  }
})
