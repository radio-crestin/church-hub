import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * T-021: the add-song picker (program "Add item" → Song) has the same
 * category and tag filters as the Songs page, in browse and in search mode.
 */

interface Fixture {
  uniq: number
  carols: { id: number; name: string }
  hymns: { id: number; name: string }
  youth: { id: number; name: string }
  songIds: number[]
  scheduleId: number
}

async function post(request: APIRequestContext, url: string, data: object) {
  const res = await request.post(url, { data })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data
}

async function createFixture(request: APIRequestContext): Promise<Fixture> {
  const uniq = Date.now()
  const carols = await post(request, '/api/categories', {
    name: `E2E Carols ${uniq}`,
  })
  const hymns = await post(request, '/api/categories', {
    name: `E2E Hymns ${uniq}`,
  })
  const youth = await post(request, '/api/song-tags', {
    name: `E2E Youth ${uniq}`,
  })
  const song = (title: string, categoryId: number, tagIds: number[]) =>
    post(request, '/api/songs', {
      title: `${title} ${uniq}`,
      categoryId,
      tagIds,
      slides: [{ content: `${title} ${uniq}`, sortOrder: 0 }],
    })
  const songs = [
    await song('Carol tagged', carols.id, [youth.id]),
    await song('Carol plain', carols.id, []),
    await song('Hymn tagged zanzibar', hymns.id, [youth.id]),
  ]
  const schedule = await post(request, '/api/schedules', {
    title: `E2E Picker Filters ${uniq}`,
  })
  return {
    uniq,
    carols,
    hymns,
    youth,
    songIds: songs.map((s) => s.id),
    scheduleId: schedule.id,
  }
}

async function removeFixture(request: APIRequestContext, fixture: Fixture) {
  await request.delete(`/api/schedules/${fixture.scheduleId}`).catch(() => {})
  for (const id of fixture.songIds) {
    await request.delete(`/api/songs/${id}`).catch(() => {})
  }
  await request.delete(`/api/song-tags/${fixture.youth.id}`).catch(() => {})
  await request.delete(`/api/categories/${fixture.carols.id}`).catch(() => {})
  await request.delete(`/api/categories/${fixture.hymns.id}`).catch(() => {})
}

test.describe('Song picker category and tag filters', () => {
  let fixture: Fixture

  test.beforeEach(async ({ request }) => {
    fixture = await createFixture(request)
  })

  test.afterEach(async ({ request }) => {
    await removeFixture(request, fixture)
  })

  test('search API narrows results by tag', async ({ request }) => {
    const titles = async (params: string) => {
      const res = await request.get(
        `/api/songs/search?q=${fixture.uniq}${params}`,
      )
      const { data } = await res.json()
      return (data as { title: string }[]).map((s) => s.title).sort()
    }

    expect(await titles('')).toHaveLength(3)
    expect(await titles(`&tagIds=${fixture.youth.id}`)).toEqual([
      `Carol tagged ${fixture.uniq}`,
      `Hymn tagged zanzibar ${fixture.uniq}`,
    ])
    expect(
      await titles(
        `&tagIds=${fixture.youth.id}&categoryIds=${fixture.carols.id}`,
      ),
    ).toEqual([`Carol tagged ${fixture.uniq}`])
  })

  test('filters the picker by category and tag, browsing and searching', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/schedules/${fixture.scheduleId}`)
    await page.waitForLoadState('networkidle')

    await page.getByTestId('schedule-add-item').click()
    const modal = page.getByTestId('add-schedule-item-modal')
    await modal.getByTestId('add-schedule-item-song').click()
    await expect(modal.getByTestId('song-picker-search')).toBeVisible()

    const rows = modal.getByTestId('song-picker-row')
    const pick = async (filterTestId: string, optionName: string) => {
      await modal.getByTestId(filterTestId).getByRole('button').first().click()
      // The dropdown portals into the dialog, so it is clickable above it.
      await modal.getByRole('button', { name: optionName, exact: true }).click()
      await page.keyboard.press('Escape')
    }

    const search = modal.getByTestId('song-picker-search')

    // Category works as on the Songs page: all are checked, unchecking one
    // hides its songs. Searching keeps the category filter.
    await pick('song-picker-category-filter', fixture.hymns.name)
    await search.fill(`${fixture.uniq}`)
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: 'Hymn tagged' })).toHaveCount(0)

    // Browse mode: picking a tag keeps only the carol carrying it, and the
    // row names its category.
    await search.fill('')
    await pick('song-picker-tag-filter', fixture.youth.name)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`Carol tagged ${fixture.uniq}`)
    await expect(rows.first()).toContainText(fixture.carols.name)

    // Search mode keeps both filters.
    await search.fill(`${fixture.uniq}`)
    await expect(modal.getByTestId('song-picker-count')).toContainText('1')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`Carol tagged ${fixture.uniq}`)

    // A search the filters exclude offers to clear them.
    await search.fill('zanzibar')
    await expect(rows).toHaveCount(0)
    await modal.getByTestId('song-picker-clear-filters').click()
    await expect(rows.first()).toContainText(
      `Hymn tagged zanzibar ${fixture.uniq}`,
    )
  })
})
