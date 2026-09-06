import { expect, type Page, test } from '@playwright/test'

/**
 * Regression guard for the song editor header row.
 *
 * The header puts the back arrow + the song title on the left and the actions
 * (Adaugă în program / Prezintă acum / delete / Salvează) on the right. The
 * page also renders two asides — the slide rail (288px at `lg`, 320px at `xl`)
 * and the Programe panel (288px at `xl`) — so the column the header lives in is
 * far narrower than the viewport: a 1366px laptop leaves it roughly 600px.
 *
 * The actions group is `shrink-0`, so when it did not fit the whole deficit
 * landed on the title group: the <h1> collapsed to 0px wide (invisible, because
 * it is `truncate`d) and the `shrink-0` back arrow slid underneath the first
 * action button. That happened at 1280–1377 and 1024–1050 with the sidebar
 * collapsed, and all the way up to 1512 with it expanded.
 *
 * The fix makes the header a container query context, so the action labels only
 * appear once the header row itself is wide enough for them plus a readable
 * title. These assertions therefore check geometry, not just presence.
 */

/** Long enough that the title must truncate rather than fit. */
const LONG_TITLE = 'Mare este Domnul și vrednic de toată lauda în cetatea Lui'

/** The <h1> must keep at least this much room — 0px was the bug. */
const MIN_TITLE_WIDTH = 120

interface Viewport {
  name: string
  width: number
  height: number
  sidebarCollapsed: boolean
}

const VIEWPORTS: Viewport[] = [
  // Both asides are on (xl) and the middle column is only ~512px.
  {
    name: '1280x720, sidebar collapsed',
    width: 1280,
    height: 720,
    sidebarCollapsed: true,
  },
  // The most common laptop size — the middle column is ~598px.
  {
    name: '1366x768, sidebar collapsed',
    width: 1366,
    height: 768,
    sidebarCollapsed: true,
  },
  // MacBook-Pro-14 style: an expanded sidebar eats another ~200px.
  {
    name: '1440x900, sidebar expanded',
    width: 1440,
    height: 900,
    sidebarCollapsed: false,
  },
]

async function assertHeaderStaysUsable(page: Page, expectedTitle: string) {
  const header = page.getByTestId('song-editor-header')
  const heading = page.getByTestId('song-editor-title')
  const back = page.getByTestId('song-editor-back')
  const save = page.getByTestId('song-editor-save')
  const actions = page.getByTestId('song-editor-header-actions')

  // Nothing may be display:none-d or squashed to a zero-area box. Playwright
  // treats a 0-width element as not visible, which is exactly how the <h1>
  // failed before the fix.
  await expect(heading).toBeVisible()
  await expect(back).toBeVisible()
  await expect(save).toBeVisible()
  await expect(heading).toHaveText(expectedTitle)

  const headerBox = await header.boundingBox()
  const headingBox = await heading.boundingBox()
  const backBox = await back.boundingBox()
  const saveBox = await save.boundingBox()
  const actionsBox = await actions.boundingBox()

  expect(headerBox).not.toBeNull()
  expect(headingBox).not.toBeNull()
  expect(backBox).not.toBeNull()
  expect(saveBox).not.toBeNull()
  expect(actionsBox).not.toBeNull()
  if (!headerBox || !headingBox || !backBox || !saveBox || !actionsBox) return

  // The title truncates with an ellipsis instead of collapsing.
  expect(headingBox.width).toBeGreaterThanOrEqual(MIN_TITLE_WIDTH)

  // The back arrow sits left of the actions instead of sliding under them.
  expect(backBox.x + backBox.width).toBeLessThanOrEqual(actionsBox.x + 1)

  // The title never runs into the actions group either.
  expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(actionsBox.x + 1)

  // And the actions (Salvează is the last one) stay inside the column rather
  // than spilling under the Programe aside.
  expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(
    headerBox.x + headerBox.width + 1,
  )
  expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(
    headerBox.x + headerBox.width + 1,
  )
}

test.describe('Song editor header layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`title, back and Save stay usable at ${viewport.name}`, async ({
      page,
      request,
    }) => {
      const createResponse = await request.post('/api/songs', {
        data: {
          title: LONG_TITLE,
          slides: [{ content: 'Strofa unu', sortOrder: 0 }],
        },
      })
      expect(createResponse.status()).toBe(201)
      const { data: created } = await createResponse.json()

      try {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        })

        const collapsed = viewport.sidebarCollapsed
        await page.addInitScript(
          ({ isCollapsed }: { isCollapsed: boolean }) => {
            window.localStorage.setItem(
              'sidebar-collapsed',
              isCollapsed ? 'true' : 'false',
            )
            // The seeded test database already stores language=ro; priming the
            // detector keeps the first paint Romanian too, so the assertions
            // always run against the widest button labels.
            window.localStorage.setItem('church-hub-language', 'ro')
          },
          { isCollapsed: collapsed },
        )

        await page.goto(`/songs/${created.id}/edit`)
        await page.waitForLoadState('networkidle')

        await assertHeaderStaysUsable(page, created.title)
      } finally {
        await request.delete(`/api/songs/${created.id}`)
      }
    })
  }
})
