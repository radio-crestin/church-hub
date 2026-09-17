import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Below the `lg` breakpoint a Workspace does not form columns: its panels stack
 * in one column and the page scrolls. Every panel must take the height its
 * content needs there. Panels are written to fill a desktop column slot
 * (`h-full`, `flex-1 min-h-0`), and a stack sized by the page used to squeeze
 * them into it: the control panel lost its Prev/Next buttons, the slides list
 * was cut in half and the PowerPoint stage spilled over Versiuni.
 *
 * Nothing here presents: the Prev/Next buttons are only hit-tested.
 */

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]

interface Fixture {
  songId?: number
  scheduleId?: number
}

async function createFixture(request: APIRequestContext, fixture: Fixture) {
  const uniq = Date.now()
  // Enough slides that the slides panel is far taller than a phone screen.
  const slides = Array.from({ length: 8 }, (_, index) => ({
    content: `Verse ${index + 1}\nsecond line\nthird line\nfourth line`,
    sortOrder: index,
  }))
  const songResponse = await request.post('/api/songs', {
    data: { title: `E2E Stacked Layout ${uniq}`, slides },
  })
  expect(songResponse.status()).toBe(201)
  fixture.songId = (await songResponse.json()).data.id

  const scheduleResponse = await request.post('/api/schedules', {
    data: { title: `E2E Stacked Layout Program ${uniq}` },
  })
  expect(scheduleResponse.ok()).toBeTruthy()
  fixture.scheduleId = (await scheduleResponse.json()).data.id
  for (let index = 0; index < 6; index++) {
    const itemResponse = await request.post(
      `/api/schedules/${fixture.scheduleId}/items`,
      { data: { songId: fixture.songId } },
    )
    expect(itemResponse.ok()).toBeTruthy()
  }
}

async function removeFixture(request: APIRequestContext, fixture: Fixture) {
  if (fixture.scheduleId) {
    await request.delete(`/api/schedules/${fixture.scheduleId}`)
  }
  if (fixture.songId) await request.delete(`/api/songs/${fixture.songId}`)
}

/**
 * Asserts the stack holds exactly `panelIds`, in that order, and that none of
 * them cuts its content: neither the panel's slot (which content spilling out
 * of a squeezed panel would overflow) nor the panel's own root, the card that
 * clips with `overflow-hidden`.
 */
async function expectUnclippedStack(page: Page, panelIds: string[]) {
  const panels = page.locator('[data-testid^="workspace-panel-"]')
  await expect(panels).toHaveCount(panelIds.length, { timeout: 15000 })
  expect(
    await panels.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).dataset.testid),
    ),
  ).toEqual(panelIds.map((id) => `workspace-panel-${id}`))

  // Content (lists, previews) settles a moment after the panels mount.
  await expect
    .poll(
      () =>
        panels.evaluateAll((elements) =>
          elements.flatMap((panel) =>
            [panel, panel.firstElementChild]
              .filter((element): element is Element => element !== null)
              .filter(
                (element) => element.scrollHeight > element.clientHeight + 1,
              )
              .map(
                (element) =>
                  `${(panel as HTMLElement).dataset.testid}: ${element.clientHeight} of ${element.scrollHeight}px`,
              ),
          ),
        ),
      { timeout: 10000 },
    )
    .toEqual([])
}

/**
 * Scrolls the button into view the way an operator can, and checks it is the
 * element actually under its centre. `scrollIntoView` also scrolls the cards
 * that clip with `overflow-hidden` — which no wheel or finger ever can — so
 * those are put back first: a button cut off by a squeezed panel then stays
 * out of reach, as it is on screen.
 */
async function expectReachable(page: Page, testId: string) {
  const button = page.getByTestId(testId)
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeVisible()
  await expect
    .poll(() =>
      button.evaluate((element) => {
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const { overflowY } = getComputedStyle(ancestor)
          if (overflowY === 'hidden' || overflowY === 'clip') {
            ancestor.scrollTop = 0
          }
        }
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        return hit !== null && element.contains(hit)
      }),
    )
    .toBe(true)
}

for (const viewport of VIEWPORTS) {
  test.describe(`Stacked workspace at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    test('the song page stacks every panel at its full height, in both layouts', async ({
      page,
      request,
    }) => {
      const fixture: Fixture = {}
      try {
        await createFixture(request, fixture)

        await page.addInitScript(() => {
          if (!window.sessionStorage.getItem('e2e-stacked-layout')) {
            window.localStorage.setItem('song-editor-layout', 'normal')
            window.sessionStorage.setItem('e2e-stacked-layout', '1')
          }
        })
        await page.goto(`/songs/${fixture.songId}`)
        await expect(page.getByTestId('song-control-next')).toBeAttached({
          timeout: 15000,
        })

        await expectReachable(page, 'song-control-prev')
        await expectReachable(page, 'song-control-next')
        await expectUnclippedStack(page, ['control', 'slides', 'versions'])

        await page.evaluate(() =>
          window.localStorage.setItem('song-editor-layout', 'powerpoint'),
        )
        await page.reload()
        await expect(page.getByTestId('workspace-panel-stage')).toBeAttached({
          timeout: 15000,
        })
        await expectUnclippedStack(page, ['stage', 'versions'])
      } finally {
        await removeFixture(request, fixture)
      }
    })

    test('the Bible page stacks its panels at their full height', async ({
      page,
    }) => {
      await page.goto('/bible')
      await expectUnclippedStack(page, ['control', 'navigation'])
    })

    test('the program page stacks its panels at their full height', async ({
      page,
      request,
    }) => {
      const fixture: Fixture = {}
      try {
        await createFixture(request, fixture)
        await page.goto(`/schedules/${fixture.scheduleId}`)
        await expect(page.getByTestId('schedule-preview-next')).toBeAttached({
          timeout: 15000,
        })

        await expectReachable(page, 'schedule-preview-prev')
        await expectReachable(page, 'schedule-preview-next')
        await expectUnclippedStack(page, ['preview', 'items'])
      } finally {
        await removeFixture(request, fixture)
      }
    })
  })
}
