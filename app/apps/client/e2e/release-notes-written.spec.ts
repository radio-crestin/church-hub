import { execFile, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { renderWrittenNotes } from '../src/features/release-notes/service/writtenNotesBlock'

/**
 * T-044: the agent cutting a release writes its notes in plain English and
 * Romanian (written-notes.json); release.sh refuses a version without them.
 * generate-changelog.ts puts them in the CHANGELOG.md section the release CI
 * copies into the GitHub release, and the app shows them in Settings > About
 * and on the updates page (GitHub stood in by a route).
 */

const REPO_DIR = fileURLToPath(new URL('../../../..', import.meta.url))
const run = promisify(execFile)

const WRITTEN = {
  en: {
    features: ['Song slides now appear on the projector much faster.'],
    bugFixes: [
      'Each display shows its number and name again when you press Identify.',
    ],
  },
  ro: {
    features: ['Cântările apar pe proiector mult mai repede.'],
    bugFixes: [
      'La Identifică, fiecare ecran își arată din nou numărul și numele.',
    ],
  },
}

/** GitHub's releases, with `version` carrying the written notes. */
async function routeGithub(page: Page, version: string) {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: [
        {
          tag_name: `v${version}`,
          name: `v${version}`,
          // The release body: the version's CHANGELOG.md section, as generate-changelog.ts writes it.
          body: `# Church Hub v${version}\n\n---\n\n${renderWrittenNotes(WRITTEN).join('\n')}`,
          html_url: `https://github.com/radio-crestin/church-hub/releases/tag/v${version}`,
          published_at: '2026-11-22T10:00:00Z',
          draft: false,
          prerelease: false,
          assets: [],
        },
      ],
    }),
  )
}

test('release.sh refuses to bump a version whose notes are not written', async () => {
  test.skip(process.platform === 'win32', 'release.sh runs on macOS and Linux')
  // Before any change: the check comes first, then lists the commits to write from.
  const result = await run(
    'bash',
    [join(REPO_DIR, 'scripts/release.sh'), '99.0.0'],
    {
      cwd: REPO_DIR,
      timeout: 60_000,
    },
  ).catch((error: { code: number; stderr: string }) => error)
  expect('code' in result && result.code).toBe(1)
  expect(result.stderr).toContain('no release notes for v99.0.0 yet')
  expect(result.stderr).toContain('written-notes.json')
  const head = execFileSync(
    'git',
    ['log', '-1', '--no-merges', '--format=%s'],
    {
      cwd: REPO_DIR,
      encoding: 'utf-8',
      timeout: 10_000,
    },
  ).trim()
  expect(result.stderr).toContain(`- ${head}`)
})

test('Settings > About shows the written notes in the app language, not the commits', async ({
  page,
}) => {
  await setAppLanguage(page, 'ro')
  await page.goto('/settings/about')
  const version = await page.evaluate(() => window.__appVersion)
  await routeGithub(page, version)
  await page.reload()

  const section = page.getByTestId('release-notes-section')
  await expect(section).toBeVisible({ timeout: 10000 })
  await expect(section).toContainText(WRITTEN.ro.features[0])
  await expect(section).toContainText(WRITTEN.ro.bugFixes[0])
  await expect(section).not.toContainText(WRITTEN.en.features[0])
  await expect(section).toContainText(/Funcționalități \(1\)/)

  await setAppLanguage(page, 'en')
  await page.reload()
  await expect(section).toContainText(WRITTEN.en.bugFixes[0], {
    timeout: 10000,
  })
})

test('the updates page shows a new version with its written notes', async ({
  page,
}) => {
  await setAppLanguage(page, 'en')
  await routeGithub(page, '99.0.0')
  await page.goto('/settings/updates')
  const panel = page.getByTestId('update-panel')
  await expect(panel).toBeVisible({ timeout: 10000 })
  await panel.getByTestId('update-check-now').click()
  await expect(panel.getByTestId('update-new-version')).toHaveText('v99.0.0', {
    timeout: 15000,
  })

  const card = panel.getByTestId('update-version-notes')
  await expect(card).toContainText(WRITTEN.en.features[0])
  await expect(card).toContainText(WRITTEN.en.bugFixes[0])
  // The commit list stays on GitHub.
  await expect(card).not.toContainText('T-158')
  await expect(card).not.toContainText('church-hub-notes')
})
