import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Programs are managed from the sidebar too (T-088): the "Programs" entry
 * lists them, beside the programs page.
 */

interface ProgramRow {
  id: number
  title: string
}

const made: number[] = []

async function makeProgram(
  request: APIRequestContext,
  title: string,
): Promise<number> {
  const res = await request.post('/api/schedules', { data: { title } })
  expect(res.ok()).toBeTruthy()
  const id = (await res.json()).data.id as number
  made.push(id)
  return id
}

async function programsTitled(
  request: APIRequestContext,
  title: string,
): Promise<ProgramRow[]> {
  const { data } = await (await request.get('/api/schedules')).json()
  return (data as ProgramRow[]).filter((row) => row.title === title)
}

function sidebarRow(page: Page, title: string) {
  return page
    .getByTestId('sidebar-program')
    .filter({ has: page.getByText(title, { exact: true }) })
}

async function openRowMenu(page: Page, title: string) {
  const row = sidebarRow(page, title)
  await row.hover()
  await row.getByTestId('sidebar-program-menu').click()
}

test.describe('Programs in the sidebar', () => {
  test.afterAll(async ({ request }) => {
    for (const id of made) {
      await request.delete(`/api/schedules/${id}`).catch(() => {})
    }
  })

  test('lists programs under the entry and opens one', async ({
    page,
    request,
  }) => {
    const title = `Sidebar open ${Date.now()}`
    const id = await makeProgram(request, title)

    await page.goto('/songs')
    const row = sidebarRow(page, title)
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/schedules/${id}$`))
    await expect(row).toHaveAttribute('data-active', 'true')
    await expect(
      page.getByRole('heading', { level: 1 }).getByText(title),
    ).toBeVisible()
  })

  test('makes a new program from the sidebar', async ({ page, request }) => {
    const title = `Sidebar new ${Date.now()}`
    await page.goto('/songs')

    await page.getByTestId('sidebar-program-new').click()
    const dialog = page
      .getByTestId('sidebar-program-list')
      .getByTestId('create-schedule-modal')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').fill(title)
    await dialog.getByRole('textbox').press('Enter')

    await expect(sidebarRow(page, title)).toBeVisible({ timeout: 10000 })
    const [created] = await programsTitled(request, title)
    expect(created).toBeTruthy()
    made.push(created.id)
    await expect(page).toHaveURL(new RegExp(`/schedules/${created.id}$`))
  })

  test('renames a program from its row menu', async ({ page, request }) => {
    const title = `Sidebar rename ${Date.now()}`
    const renamed = `${title} (renamed)`
    await makeProgram(request, title)
    await page.goto('/songs')

    await openRowMenu(page, title)
    await page.getByTestId('sidebar-program-rename').click()
    const input = page
      .getByTestId('sidebar-program-list')
      .getByTestId('rename-schedule-input')
    await input.fill(renamed)
    await input.press('Enter')

    await expect(sidebarRow(page, renamed)).toBeVisible({ timeout: 10000 })
    expect(await programsTitled(request, renamed)).toHaveLength(1)
  })

  test('deleting the open program asks first, then shows the list', async ({
    page,
    request,
  }) => {
    const title = `Sidebar delete ${Date.now()}`
    const id = await makeProgram(request, title)
    await page.goto(`/schedules/${id}`)

    await openRowMenu(page, title)
    await page.getByTestId('sidebar-program-delete').click()
    const confirm = page.getByTestId('sidebar-program-delete-confirm')
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText(title)
    await confirm.getByRole('button', { name: /delete|șterge|sterge/i }).click()

    await expect(sidebarRow(page, title)).toHaveCount(0, { timeout: 10000 })
    expect(await programsTitled(request, title)).toHaveLength(0)
    await expect(page).toHaveURL(/\/schedules\/?$/)
  })

  test('the list folds away and stays folded after a reload', async ({
    page,
    request,
  }) => {
    const title = `Sidebar fold ${Date.now()}`
    await makeProgram(request, title)
    await page.goto('/songs')

    const toggle = page.getByTestId('sidebar-programs-toggle')
    await expect(sidebarRow(page, title)).toBeVisible({ timeout: 10000 })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('sidebar-program-list')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('sidebar-programs-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(page.getByTestId('sidebar-program-list')).toHaveCount(0)

    await page.getByTestId('sidebar-programs-toggle').click()
    await expect(sidebarRow(page, title)).toBeVisible()
  })

  test('a collapsed sidebar hides the list', async ({ page, request }) => {
    await makeProgram(request, `Sidebar collapsed ${Date.now()}`)
    await page.goto('/songs')
    await expect(page.getByTestId('sidebar-program-list')).toBeVisible({
      timeout: 10000,
    })

    await page.getByTestId('sidebar-collapse-toggle').click()
    await expect(page.getByTestId('sidebar-program-list')).toBeHidden()
    await expect(page.getByTestId('sidebar-programs-toggle')).toBeHidden()
  })

  test('many programs get a filter whose X clears it', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const target = `Sidebar filter ${stamp}`
    await makeProgram(request, target)
    const { data } = await (await request.get('/api/schedules')).json()
    for (let i = (data as ProgramRow[]).length; i <= 9; i++) {
      await makeProgram(request, `Sidebar filler ${stamp}-${i}`)
    }

    await page.goto('/songs')
    const filter = page.getByTestId('sidebar-program-filter')
    await expect(filter).toBeVisible({ timeout: 10000 })

    await filter.fill(`filter ${stamp}`)
    // The title match leads; programs found by their content follow it.
    await expect(page.getByTestId('sidebar-program').first()).toContainText(
      target,
    )
    await filter.fill(`zqxjv${stamp}`)
    await expect(page.getByTestId('sidebar-program')).toHaveCount(0)

    const clear = page
      .getByTestId('sidebar-program-list')
      .getByTestId('clear-search-button')
    await clear.click()
    await expect(filter).toHaveValue('')
    await expect(filter).toBeFocused()
    await expect(clear).toBeHidden()
  })
})
