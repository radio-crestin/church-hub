import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Programs are made right in the Programe panel next to Marcaje (T-088): the
 * green + beside the program picker, or a new name typed in the picker.
 * Empty states explain, without buttons of their own.
 */

interface ProgramRow {
  id: number
  title: string
}

const made: number[] = []

async function makeProgram(request: APIRequestContext, title: string) {
  const res = await request.post('/api/schedules', { data: { title } })
  const id = (await res.json()).data.id as number
  made.push(id)
  return id
}

async function programTitled(request: APIRequestContext, title: string) {
  const { data } = await (await request.get('/api/schedules')).json()
  const row = (data as ProgramRow[]).find((p) => p.title === title)
  if (row) made.push(row.id)
  return row
}

async function openSongPageWithPanel(page: Page, songId: number) {
  await page.addInitScript(() => {
    window.localStorage.setItem('song-detail:schedules-open', 'true')
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(`/songs/${songId}`)
  await expect(page.getByTestId('schedule-songs-panel')).toBeVisible({
    timeout: 10000,
  })
}

function panel(page: Page) {
  return page.getByTestId('schedule-songs-panel')
}

test.describe('make a program in the Programe panel', () => {
  let songId: number

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/songs', {
      data: {
        title: `E2E Panel Create Song ${Date.now()}`,
        slides: [{ content: 'line', sortOrder: 0 }],
      },
    })
    songId = (await res.json()).data.id
  })

  test.afterEach(async ({ request }) => {
    for (const id of made.splice(0)) {
      await request.delete(`/api/schedules/${id}`).catch(() => {})
    }
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('"+" next to the program picker makes a program and picks it', async ({
    page,
    request,
  }) => {
    await makeProgram(request, `E2E Existing ${Date.now()}`)
    const title = `E2E Picker Plus ${Date.now()}`
    await openSongPageWithPanel(page, songId)

    const plus = panel(page).getByTestId('schedule-picker-new')
    await plus.hover()
    await expect(page.getByText(/^(New program|Program nou)$/)).toBeVisible()
    await plus.click()
    const dialog = panel(page).getByTestId('create-schedule-modal')
    await dialog.getByRole('textbox').fill(title)
    await dialog.getByRole('textbox').press('Enter')

    await expect(panel(page).getByTestId('schedule-picker')).toContainText(
      title,
      { timeout: 10000 },
    )
    expect(await programTitled(request, title)).toBeTruthy()
    // The + lives only beside the picker now, not in the header too.
    await expect(panel(page).getByTestId('schedule-new')).toHaveCount(0)
    // A new program is empty: the panel says so, without its own add button.
    const empty = panel(page).getByTestId('schedule-panel-empty-program')
    await expect(empty).toBeVisible()
    await expect(empty.getByRole('button')).toHaveCount(0)
  })

  test('a new name typed in the picker becomes a program', async ({
    page,
    request,
  }) => {
    await makeProgram(request, `E2E Existing ${Date.now()}`)
    const title = `E2E Typed ${Date.now()}`
    await openSongPageWithPanel(page, songId)

    await panel(page).getByTestId('schedule-picker').click()
    const dropdown = page.getByTestId('schedule-picker-dropdown')
    await dropdown.getByRole('textbox').fill(title)
    await dropdown.getByRole('button', { name: new RegExp(title) }).click()

    await expect(panel(page).getByTestId('schedule-picker')).toContainText(
      title,
      { timeout: 10000 },
    )
    expect(await programTitled(request, title)).toBeTruthy()
  })

  test('with no program yet, the panel offers to make the first one', async ({
    page,
  }) => {
    // Show the panel as a fresh install sees it, without deleting the
    // programs other tests rely on.
    await page.route('**/api/schedules', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { data: [] } })
        : route.continue(),
    )
    await openSongPageWithPanel(page, songId)

    const empty = panel(page).getByTestId('schedule-panel-no-programs')
    await expect(empty).toBeVisible()
    // It points to the header's green + instead of offering buttons of its own.
    await expect(empty.getByRole('button')).toHaveCount(0)
    await expect(empty).toContainText(/green \+|verde \+/)
    await expect(panel(page).getByTestId('schedule-picker-new')).toBeVisible()
  })
})
