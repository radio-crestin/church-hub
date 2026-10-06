import { expect, type Page, test } from '@playwright/test'

/**
 * New songs in the song sources show in the sidebar's update notification,
 * one line per source, each opening Song discovery on that source, whose tab
 * then shows the source's own count. Dismissing it lasts until a source
 * changes.
 */

const ts = Date.now()
const titles = [`Notice Song A ${ts}`, `Notice Song B ${ts}`]

const LD = 'song-discovery-source:laudele-domnului'
const PDC = 'song-discovery-source:pe-drumul-credintei'

/** What the background check (skipped under automation) would have found. */
async function seedChecks(page: Page) {
  await page.addInitScript(
    ({ ld, pdc, now }) => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.removeItem('song-discovery-dismissed-signature')
      const check = (signature: string, count: number) =>
        JSON.stringify({ signature, count, checkedAt: now })
      localStorage.setItem(ld, check('ld-1', 2))
      localStorage.setItem(pdc, check('pdc-1', 7))
    },
    { ld: LD, pdc: PDC, now: Date.now() },
  )
}

/** Laudele Domnului's catalogue: two songs the library lacks. */
async function mockLaudeleDomnului(page: Page) {
  await page.route(/\/api\/proxy\/download\?url=.*categorie%3Dld/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rezultate: titles.map((title, i) => ({
          id: String(i),
          denumire: title,
          descriere: `${title} first verse line\n\nand a second stanza`,
          url_fisier: null,
        })),
      }),
    }),
  )
}

test.describe('New songs in the update notification', () => {
  test.beforeEach(async ({ page }) => {
    await seedChecks(page)
    await mockLaudeleDomnului(page)
  })

  test('lists each source with its new songs and opens it', async ({
    page,
  }) => {
    await page.goto('/songs')
    const notice = page.getByTestId('sidebar-new-songs')
    await expect(notice).toContainText(/9 new songs|9 cântări noi/)
    await expect(
      notice.getByRole('button', { name: /Laudele Domnului\s*2/ }),
    ).toBeVisible()
    await expect(
      notice.getByRole('button', { name: /Pe drumul credinței\s*7/ }),
    ).toBeVisible()

    await notice.getByRole('button', { name: /Laudele Domnului/ }).click()
    await expect(page).toHaveURL(/source=laudele-domnului/)
    // Opening Song discovery is the "seen it" signal.
    await expect(notice).toHaveCount(0)

    await expect(page.getByText(titles[0])).toBeVisible({ timeout: 30_000 })
    const tab = (name: string) => page.getByRole('tab', { name, exact: true })
    await expect(tab('Laudele Domnului')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(tab('Laudele Domnului')).toContainText(/2 new|2 noi/)
    await expect(tab('Pe drumul credinței')).toContainText(/7 new|7 noi/)

    // One click picks every song; a second clears the selection.
    await page.getByRole('button', { name: /Select all|Selectează tot/ }).click()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(titles[1]) }),
    ).toBeChecked()
    await expect(
      page.getByRole('button', { name: /Import selected|Importă selecția/ }),
    ).toContainText('2')
    await page
      .getByRole('button', { name: /Clear selection|Deselectează tot/ })
      .click()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(titles[1]) }),
    ).not.toBeChecked()
  })

  test('dismissed, it stays hidden until a source changes', async ({
    page,
  }) => {
    await page.goto('/songs')
    const notice = page.getByTestId('sidebar-new-songs')
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: /Dismiss|Închide/ }).click()
    await expect(notice).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(notice).toHaveCount(0)

    // Pe drumul credinței publishes new songs: its checksum changes.
    await page.evaluate((key) => {
      const check = JSON.parse(localStorage.getItem(key) ?? '{}')
      localStorage.setItem(
        key,
        JSON.stringify({ ...check, signature: 'pdc-2', count: 9 }),
      )
    }, PDC)
    await page.reload()
    await expect(notice).toContainText(/11 new songs|11 (de )?cântări noi/)
  })
})
