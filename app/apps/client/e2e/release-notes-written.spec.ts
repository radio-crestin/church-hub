import { execFile, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * T-044: in the release CI, Claude turns the commits into plain-language
 * notes in English and Romanian. The script's request and output are checked
 * against a stand-in Anthropic API (no key, no network); the app shows the
 * notes from a release body in Settings > About and on the updates page,
 * with GitHub stood in by a route.
 */

const APP_DIR = fileURLToPath(new URL('../../..', import.meta.url))
const BUN = process.platform === 'win32' ? 'bun.exe' : 'bun'
// Async: the stand-in API runs in this process and must answer meanwhile.
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

function block(): string {
  return `<!-- church-hub-notes ${JSON.stringify(WRITTEN)} -->`
}

/** GitHub's releases, with `version` carrying the written notes. */
async function routeGithub(page: Page, version: string) {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: [
        {
          tag_name: `v${version}`,
          name: `v${version}`,
          body: `## What's new\n\n- ${WRITTEN.en.features[0]}\n\n${block()}\n\n## What's Changed\n\n### 🔧 Changes\n\n- T-158 Slides appear on the projector much faster`,
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

test('the release CI script asks Claude for the notes and writes them into the release body', async () => {
  const requests: { headers: Record<string, unknown>; body: any }[] = []
  const api = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      requests.push({ headers: req.headers, body: JSON.parse(raw) })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(WRITTEN) }],
        }),
      )
    })
  })
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve))
  const { port } = api.address() as AddressInfo
  const dir = mkdtempSync(join(tmpdir(), 'release-notes-'))
  const out = join(dir, 'notes.md')
  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: 'e2e-key',
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
  }
  try {
    await run(BUN, ['scripts/write-release-notes.ts', '99.0.0', '--out', out], {
      cwd: APP_DIR,
      env,
      timeout: 60_000,
    })

    // One request: the commits, a JSON schema for both languages, the key from the env.
    expect(requests).toHaveLength(1)
    const [{ headers, body }] = requests
    expect(headers['x-api-key']).toBe('e2e-key')
    expect(body.model).toBe('claude-opus-5-5')
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema.required).toEqual(['en', 'ro'])
    const head = execFileSync('git', ['log', '-1', '--format=%s'], {
      cwd: APP_DIR,
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim()
    expect(body.messages[0].content).toContain(head)

    // Readable on GitHub in both languages, and the block the app reads.
    const section = readFileSync(out, 'utf-8')
    expect(section).toContain("## What's new")
    expect(section).toContain(`- ${WRITTEN.en.features[0]}`)
    expect(section).toContain('## Ce e nou')
    expect(section).toContain(`- ${WRITTEN.ro.bugFixes[0]}`)
    expect(section).toContain(block())

    // Without a key it fails, and the release keeps its commit list.
    const { ANTHROPIC_API_KEY: _, ...noKey } = env
    expect(() =>
      execFileSync(
        BUN,
        ['scripts/write-release-notes.ts', '99.0.0', '--out', out],
        {
          cwd: APP_DIR,
          env: noKey,
          stdio: 'pipe',
          timeout: 60_000,
        },
      ),
    ).toThrow(/ANTHROPIC_API_KEY/)
  } finally {
    api.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the sync back to main keeps the notes for the bundled changelog', async () => {
  const file = join(
    APP_DIR,
    'apps/client/src/features/release-notes/written-notes.json',
  )
  const original = readFileSync(file, 'utf-8')
  const dir = mkdtempSync(join(tmpdir(), 'release-notes-'))
  const body = join(dir, 'body.md')
  writeFileSync(body, `# Church Hub v99.0.0\n\n${block()}\n`)
  try {
    execFileSync(BUN, ['scripts/save-written-notes.ts', '99.0.0', body], {
      cwd: APP_DIR,
      stdio: 'pipe',
      timeout: 60_000,
    })
    expect(JSON.parse(readFileSync(file, 'utf-8'))['99.0.0']).toEqual(WRITTEN)
  } finally {
    writeFileSync(file, original)
    rmSync(dir, { recursive: true, force: true })
  }
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
