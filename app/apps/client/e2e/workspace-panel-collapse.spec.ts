import { expect, type Page, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * Marcaje / Programe / Versiuni share one column, and each shuts down to its
 * header with its own chevron. However the column got into its state — one
 * section shut or two, in any order, after resizing by hand, after a reload or
 * a trip through the other editing layout — it never shows a band of nothing:
 * a shut section is exactly its header, and the sections still open share the
 * rest of the column between them.
 *
 * It used to: shutting a section gave its room only to the section right next
 * to it, so when that neighbour was shut too its header sat on top of an empty
 * band while the one section still open stayed the size it was, and the
 * operator had to drag the dividers to get the space back.
 */

// The workspace only renders as columns on large (lg) screens.
test.use({ viewport: { width: 1440, height: 900 } })

const PANEL_IDS = ['bookmarks', 'schedules', 'versions'] as const
type PanelId = (typeof PANEL_IDS)[number]

const TOGGLES: Record<PanelId, string> = {
  bookmarks: 'bookmarks-collapse-toggle',
  schedules: 'schedule-collapse-toggle',
  versions: 'versions-collapse-toggle',
}

/** Height of the divider drawn between two rows (`WorkspaceSeparator`). */
const SEPARATOR_PX = 8

type Layout = 'normal' | 'powerpoint'

interface ColumnMeasure {
  height: number
  /** Each row's slot, and how much of it the panel's content actually uses. */
  rows: Record<PanelId, { height: number; content: number }>
}

/** The side-panel column as it is laid out on screen right now. */
async function measureColumn(page: Page): Promise<ColumnMeasure> {
  return page.evaluate((ids) => {
    const box = (element: Element | null | undefined) => {
      if (!element) throw new Error('a side panel is not on the page')
      return element.getBoundingClientRect().height
    }
    const frame = (id: string) =>
      document.querySelector(`[data-testid="workspace-panel-${id}"]`)
    const rows = {} as ColumnMeasure['rows']
    for (const id of ids) {
      rows[id] = {
        height: box(frame(id)),
        // A shut panel's content is only its header; an open one fills its row.
        content: box(frame(id)?.firstElementChild),
      }
    }
    return { height: box(frame(ids[0])?.closest('[data-group]')), rows }
  }, PANEL_IDS)
}

/**
 * Pixels of the column showing nothing: rows taller than what they hold, plus
 * whatever the rows and dividers leave over at the bottom.
 */
function emptySpace(column: ColumnMeasure): number {
  const rows = Object.values(column.rows)
  const unusedInRows = rows.reduce(
    (total, row) => total + Math.abs(row.height - row.content),
    0,
  )
  const used =
    rows.reduce((total, row) => total + row.height, 0) +
    SEPARATOR_PX * (rows.length - 1)
  return unusedInRows + Math.abs(column.height - used)
}

/** Waits for the column to settle with no empty band anywhere in it. */
async function expectColumnFilled(page: Page): Promise<ColumnMeasure> {
  await expect
    .poll(async () => emptySpace(await measureColumn(page)), { timeout: 5000 })
    .toBeLessThanOrEqual(3)
  return measureColumn(page)
}

/** Room the column has left once the shut rows' headers and dividers are in. */
function roomForOpenRows(column: ColumnMeasure, shut: PanelId[]): number {
  return (
    column.height -
    shut.reduce((total, id) => total + column.rows[id].height, 0) -
    SEPARATOR_PX * (PANEL_IDS.length - 1)
  )
}

async function openPage(page: Page, songId: number) {
  await page.goto(`/songs/${songId}`)
  await expect(page.getByTestId('workspace-panel-versions')).toBeVisible({
    timeout: 15000,
  })
}

/**
 * Seeds which sections are open and which editing layout is on — once, on the
 * first load of the test, so a reload later in the test sees what the test did
 * rather than the seed again.
 */
async function seedPreferences(
  page: Page,
  layout: Layout,
  open: Record<PanelId, boolean>,
) {
  await page.addInitScript(
    ({ layout, open }) => {
      if (window.sessionStorage.getItem('e2e-panel-collapse-seeded')) return
      window.sessionStorage.setItem('e2e-panel-collapse-seeded', '1')
      window.localStorage.setItem('song-editor-layout', layout)
      window.localStorage.setItem(
        'song-detail:bookmarks-open',
        String(open.bookmarks),
      )
      window.localStorage.setItem(
        'song-detail:schedules-open',
        String(open.schedules),
      )
      window.localStorage.setItem(
        'song-detail:versions-open',
        String(open.versions),
      )
    },
    { layout, open },
  )
}

const ALL_OPEN = { bookmarks: true, schedules: true, versions: true }

test.describe('Shutting side panels', () => {
  let songId: number

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Panel Collapse ${Date.now()}`,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(response.status()).toBe(201)
    songId = (await response.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
  })

  for (const layout of ['normal', 'powerpoint'] as const) {
    test.describe(`in the ${layout} layout`, () => {
      test('shutting one section gives its room to both open ones, in the proportions they had', async ({
        page,
      }) => {
        await seedPreferences(page, layout, ALL_OPEN)
        await openPage(page, songId)
        await expectColumnFilled(page)

        // Make Marcaje taller than Programe by hand first: shutting Versiuni
        // must not undo that.
        const divider = page
          .getByTestId('workspace-panel-bookmarks')
          .locator('xpath=ancestor::*[@data-group][1]')
          .locator(':scope > [role="separator"]')
          .first()
        const handle = await divider.boundingBox()
        if (!handle) throw new Error('no divider under Marcaje')
        await page.mouse.move(
          handle.x + handle.width / 2,
          handle.y + handle.height / 2,
        )
        await page.mouse.down()
        await page.mouse.move(handle.x + handle.width / 2, handle.y + 120, {
          steps: 10,
        })
        await page.mouse.up()
        const resized = await expectColumnFilled(page)
        const ratio =
          resized.rows.bookmarks.height / resized.rows.schedules.height
        expect(ratio).toBeGreaterThan(1.3)

        await page.getByTestId(TOGGLES.versions).click()
        await expect
          .poll(async () => (await measureColumn(page)).rows.versions.height, {
            timeout: 5000,
          })
          .toBeLessThan(90)

        const shut = await expectColumnFilled(page)
        const room = roomForOpenRows(shut, ['versions'])
        expect(
          shut.rows.bookmarks.height + shut.rows.schedules.height,
        ).toBeCloseTo(room, -1)
        expect(
          shut.rows.bookmarks.height / shut.rows.schedules.height,
        ).toBeCloseTo(ratio, 1)
      })

      test('shutting two sections leaves the open one filling the column, across a reload', async ({
        page,
      }) => {
        await seedPreferences(page, layout, ALL_OPEN)
        await openPage(page, songId)
        await expectColumnFilled(page)

        // The bottom section first, then the one in the middle: its room has
        // to travel past Versiuni's header to reach Marcaje.
        await page.getByTestId(TOGGLES.versions).click()
        await expectColumnFilled(page)
        await page.getByTestId(TOGGLES.schedules).click()

        const shut = await expectColumnFilled(page)
        expect(shut.rows.schedules.height).toBeLessThan(90)
        expect(shut.rows.versions.height).toBeLessThan(90)
        expect(shut.rows.bookmarks.height).toBeCloseTo(
          roomForOpenRows(shut, ['schedules', 'versions']),
          -1,
        )

        await page.reload()
        await expect(page.getByTestId('workspace-panel-versions')).toBeVisible({
          timeout: 15000,
        })
        const reloaded = await expectColumnFilled(page)
        expect(reloaded.rows.bookmarks.height).toBeCloseTo(
          roomForOpenRows(reloaded, ['schedules', 'versions']),
          -1,
        )
      })

      test('re-opening shut sections takes their room back without leaving a gap', async ({
        page,
      }) => {
        // Programe shut is how the page ships: shutting Marcaje next used to
        // pour Marcaje's room under Programe's header.
        await seedPreferences(page, layout, {
          bookmarks: true,
          schedules: false,
          versions: true,
        })
        await openPage(page, songId)
        await expectColumnFilled(page)

        await page.getByTestId(TOGGLES.bookmarks).click()
        const shut = await expectColumnFilled(page)
        expect(shut.rows.bookmarks.height).toBeLessThan(90)
        expect(shut.rows.versions.height).toBeCloseTo(
          roomForOpenRows(shut, ['bookmarks', 'schedules']),
          -1,
        )

        await page.getByTestId(TOGGLES.bookmarks).click()
        await expect
          .poll(async () => (await measureColumn(page)).rows.bookmarks.height, {
            timeout: 5000,
          })
          .toBeGreaterThan(150)
        const reopened = await expectColumnFilled(page)
        expect(reopened.rows.versions.height).toBeGreaterThan(150)

        await page.getByTestId(TOGGLES.schedules).click()
        await expect
          .poll(async () => (await measureColumn(page)).rows.schedules.height, {
            timeout: 5000,
          })
          .toBeGreaterThan(150)
        const allOpen = await expectColumnFilled(page)
        for (const id of PANEL_IDS) {
          expect(allOpen.rows[id].height).toBeGreaterThan(150)
        }
      })

      test('a section opened in the other editing layout is open here too', async ({
        page,
      }) => {
        // Both layouts share which sections are open, but each keeps its own
        // row sizes — saved here while Versiuni was still shut.
        await seedPreferences(page, layout, ALL_OPEN)
        await openPage(page, songId)
        await page.getByTestId(TOGGLES.versions).click()
        const shut = await expectColumnFilled(page)
        expect(shut.rows.versions.height).toBeLessThan(90)

        await selectAction(page, 'song-actions-menu', 'song-toggle-layout')
        await expect(
          page.getByTestId(
            layout === 'normal'
              ? 'workspace-panel-stage'
              : 'workspace-panel-control',
          ),
        ).toBeVisible({ timeout: 15000 })
        await page.getByTestId(TOGGLES.versions).click()
        await expect
          .poll(async () => (await measureColumn(page)).rows.versions.height, {
            timeout: 5000,
          })
          .toBeGreaterThan(150)

        await selectAction(page, 'song-actions-menu', 'song-toggle-layout')
        await expect(
          page.getByTestId(
            layout === 'normal'
              ? 'workspace-panel-control'
              : 'workspace-panel-stage',
          ),
        ).toBeVisible({ timeout: 15000 })
        await expect
          .poll(async () => (await measureColumn(page)).rows.versions.height, {
            timeout: 5000,
          })
          .toBeGreaterThan(150)
        await expectColumnFilled(page)
      })
    })
  }
})
