import { expect, test } from '@playwright/test'

/**
 * A new church opens Live Stream: the default scenes are there, and the setup
 * guide walks through OBS, Church Hub's screen in OBS, the first scene, MIDI,
 * the mixer and YouTube.
 */

const DEFAULT_SCENES = [
  'Început',
  'Predică',
  'Cântare',
  'Biblie',
  'Rugăciune',
  'Anunțuri',
  'Final',
]

test.describe('Livestream setup guide', () => {
  // A spec that timed out before its cleanup (obs-scene-automation-program)
  // leaves an "E2E …" song scene first in line, which the guide would name.
  test.beforeEach(async ({ request }) => {
    const res = await request.get('/api/livestream/obs/scenes')
    const { data } = (await res.json()) as {
      data: { id: number; obsSceneName: string }[]
    }
    for (const scene of data) {
      if (scene.obsSceneName.startsWith('E2E ')) {
        await request.delete(`/api/livestream/obs/scenes/${scene.id}`)
      }
    }
  })

  test('a fresh install has the default scenes, songs and Bible switching on their own', async ({
    request,
  }) => {
    const res = await request.get('/api/livestream/obs/scenes')
    const { data } = (await res.json()) as {
      data: { obsSceneName: string; contentTypes: string[] }[]
    }
    const byName = new Map(data.map((scene) => [scene.obsSceneName, scene]))

    for (const name of DEFAULT_SCENES) expect(byName.has(name)).toBe(true)
    expect(byName.get('Cântare')?.contentTypes).toEqual([
      'song_temporary',
      'song_schedule',
    ])
    expect(byName.get('Biblie')?.contentTypes).toContain('bible')

    const config = await request.get('/api/livestream/youtube/config')
    const youtube = (await config.json()).data as {
      startSceneName?: string
      stopSceneName?: string
    }
    expect(youtube.startSceneName).toBe('Început')
    expect(youtube.stopSceneName).toBe('Final')
  })

  test('the guide walks through each step and the scenes to create', async ({
    page,
  }) => {
    await page.goto('/livestream')

    for (const name of DEFAULT_SCENES) {
      await expect(
        page.getByRole('heading', { name, exact: true }),
      ).toBeVisible()
    }

    await page
      .getByRole('button', { name: /^(Setup guide|Ghid de configurare)$/ })
      .click()
    const guide = page.getByRole('dialog', {
      name: /^(Set up your livestream|Configurează transmisiunea live)$/,
    })
    await expect(guide).toBeVisible()

    for (let step = 1; step <= 7; step++) {
      await expect(
        guide.getByTestId(`livestream-guide-step-${step}`),
      ).toBeVisible()
    }

    // Step 2: the Live Stream screen's address, ready to paste into OBS.
    await expect(guide.getByText(/\/screen\/\d+$/)).toBeVisible()

    // Step 3: the first scene by its exact name, then every scene to create.
    await expect(guide.getByTestId('livestream-guide-step-3')).toContainText(
      /[„“]Cântare”/,
    )
    const sceneList = guide.getByTestId('livestream-guide-scenes')
    for (const name of DEFAULT_SCENES) {
      await expect(sceneList.getByText(name, { exact: true })).toBeVisible()
    }

    // OBS, the mixer and YouTube are set up on their own pages.
    for (const [name, href] of [
      [/^(Open OBS setup|Deschide configurarea OBS)$/, '/livestream/obs'],
      [
        /^(Open mixer setup|Deschide configurarea mixerului)$/,
        '/livestream/mixer',
      ],
      [
        /^(Open the YouTube settings|Deschide setările YouTube)$/,
        '/livestream/youtube',
      ],
    ] as const) {
      await expect(guide.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      )
    }

    // A settings link closes the guide and opens the page it names.
    await guide
      .getByRole('link', {
        name: /^(Open scene settings|Deschide setările scenelor)$/,
      })
      .click()
    await expect(page).toHaveURL(/\/settings\/livestream$/)
    await expect(guide).toBeHidden()
  })
})
