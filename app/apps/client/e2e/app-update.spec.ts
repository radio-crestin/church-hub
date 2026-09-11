import { expect, test } from '@playwright/test'

/**
 * In-app updates, as far as a browser can see them.
 *
 * Downloading, signature verification and the install itself happen in the
 * desktop app through the Tauri updater — they replace the running
 * application, which is not something a browser tab can do or reproduce
 * here. What is covered is the page everything else stands on: the version
 * it shows, a check that keeps working, a new release rendered as release
 * notes, and the honest "cannot install from here" a browser gets.
 */
test.describe('App update - page', () => {
  test('the updates page shows the version and a working check button', async ({
    page,
  }) => {
    await page.goto('/settings/updates')
    await page.waitForLoadState('networkidle')

    const panel = page.getByTestId('update-panel')
    await expect(panel).toBeVisible({ timeout: 10000 })

    // The running version, and what pressing Install does — the restart
    // must not come as a surprise.
    await expect(panel.getByTestId('update-current-version')).toHaveText(
      /^v\d+\.\d+\.\d+/,
    )
    await expect(panel.getByTestId('update-how-it-works')).toBeVisible()

    const check = panel.getByTestId('update-check-now')
    await expect(check).toBeVisible()
    await check.click()
    // The check runs against GitHub, which may be unreachable from CI; either
    // way the page must stay usable rather than get stuck.
    await expect(check).toBeEnabled({ timeout: 15000 })
  })

  test('a new version is presented like a release-notes entry, not as markdown', async ({
    page,
  }) => {
    // Stand in for GitHub with a release newer than any build, carrying the
    // body our changelog generator writes.
    const body = [
      '# Church Hub v99.0.0',
      '',
      "## What's Changed",
      '',
      '### ✨ Features',
      '',
      '- **songs**: transpose from the stage view',
      '- remote control from a phone',
      '',
      '### 🐛 Bug Fixes',
      '',
      '- **bible**: verse search ignored diacritics',
      '',
      '### 🔧 Changes',
      '',
      '- faster startup on Windows',
      '',
      '## Direct Downloads',
      '',
      '| Platform | Download |',
      '| **macOS** | [Download .dmg](https://example.invalid/x.dmg) |',
    ].join('\n')

    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tag_name: 'v99.0.0',
            name: 'v99.0.0',
            body,
            html_url:
              'https://github.com/radio-crestin/church-hub/releases/tag/v99.0.0',
            published_at: '2026-08-23T10:00:00Z',
            draft: false,
            prerelease: false,
            assets: [],
          },
        ]),
      }),
    )

    await page.goto('/settings/updates')
    const panel = page.getByTestId('update-panel')
    await expect(panel).toBeVisible({ timeout: 10000 })

    await panel.getByTestId('update-check-now').click()
    await expect(panel.getByTestId('update-new-version')).toHaveText(
      'v99.0.0',
      {
        timeout: 15000,
      },
    )

    const card = panel.getByTestId('update-version-notes')
    await expect(card).toBeVisible()
    // Version, badge and date in the header — the same header the history
    // uses. The test database may be in either shipped language.
    await expect(card).toContainText('v99.0.0')
    await expect(card).toContainText(/New|Nouă/)
    await expect(card).toContainText('2026')
    // Grouped, with scopes pulled out of the bold prefix.
    await expect(card).toContainText(/(Features|Funcționalități) \(2\)/)
    await expect(card).toContainText('songs: transpose from the stage view')
    await expect(card).toContainText(/(Bug Fixes|Corectări de erori) \(1\)/)
    await expect(card).toContainText('bible: verse search ignored diacritics')
    await expect(card).toContainText(/(Changes|Modificări) \(1\)/)
    // No markdown leaks through, and the download table stays out.
    const text = (await card.textContent()) ?? ''
    expect(text).not.toContain('##')
    expect(text).not.toContain('**')
    expect(text).not.toContain('Direct Downloads')

    // A browser tab has no signed installer to fetch; it says so and links
    // to GitHub instead of offering a download it could not apply.
    await expect(card.getByTestId('update-unavailable')).toBeVisible()
    await expect(card.getByTestId('update-download')).toHaveCount(0)
    await expect(card.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      /releases\/tag\/v99\.0\.0/,
    )

    await card.screenshot({
      path: `${process.env.UPDATE_SHOT_DIR ?? 'test-results'}/update-card.png`,
    })
  })

  test('a pre-release of the running version is not offered as an update', async ({
    page,
  }) => {
    // The comparator is semver: a beta of the current version is older than
    // the current version, however the naive digit-by-digit reading saw it.
    const currentVersion = await page.evaluate(() => window.__appVersion)
    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tag_name: `v${currentVersion}-beta.2`,
            name: 'beta',
            body: "## What's Changed\n\n- nothing yet",
            html_url: 'https://github.com/radio-crestin/church-hub/releases',
            published_at: '2026-08-23T10:00:00Z',
            draft: false,
            prerelease: false,
            assets: [],
          },
        ]),
      }),
    )

    await page.goto('/settings/updates')
    const panel = page.getByTestId('update-panel')
    await expect(panel).toBeVisible({ timeout: 10000 })

    const check = panel.getByTestId('update-check-now')
    await check.click()
    await expect(check).toBeEnabled({ timeout: 15000 })
    await expect(panel.getByTestId('update-new-version')).toHaveCount(0)
    await expect(panel.getByTestId('update-available')).toHaveCount(0)
  })

  test('the old sidecar update API is gone', async ({ request }) => {
    // Downloads and installs go through the Tauri updater in the shell now;
    // nothing should still answer on the sidecar. In development an unknown
    // path falls through to Vite's HTML, in production to a plain 404 —
    // either way, no JSON.
    for (const path of [
      '/api/app-update/status',
      '/api/app-update/config',
      '/api/app-update/download',
    ]) {
      const res = await request.get(path)
      expect(res.headers()['content-type'] ?? '', path).not.toContain(
        'application/json',
      )
    }
  })

  test('no update dialog opens over the app', async ({ page }) => {
    // The update flow lives on its own page now — a modal that opened itself
    // interrupted whatever the operator was doing.
    await page.goto('/songs?fromSong=true')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('update-available-modal')).toHaveCount(0)
  })
})
