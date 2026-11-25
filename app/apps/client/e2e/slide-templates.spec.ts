import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * CH-184: slides are drawn with templates. Settings → Templates lists them as
 * they look; each screen picks one with a single choice, and may draw with
 * another while an OBS scene is live; a built-in template is never changed,
 * editing it saves a copy.
 */

interface Template {
  id: number
  name: string
  bundledKey: string | null
  layouts: Record<string, Record<string, unknown> & { background: unknown }>
}

const SCENE = 'Predică'

async function templates(request: APIRequestContext): Promise<Template[]> {
  return (await (await request.get('/api/slide-templates')).json()).data
}

async function createScreen(request: APIRequestContext, name: string) {
  const created = await request.post('/api/screens', {
    data: { name, type: 'primary' },
  })
  expect(created.ok()).toBe(true)
  return (await created.json()).data as { id: number; templateId: number }
}

/** A copy of Classic with a background nobody would pick by chance. */
async function redTemplate(request: APIRequestContext, name: string) {
  const classic = (await templates(request)).find(
    (template) => template.bundledKey === 'classic',
  ) as Template
  const copy = (
    await (
      await request.post('/api/slide-templates', {
        data: { name, fromId: classic.id },
      })
    ).json()
  ).data as Template
  const layouts = Object.fromEntries(
    Object.entries(copy.layouts).map(([kind, layout]) => [
      kind,
      {
        ...layout,
        background: { type: 'color', color: '#ff0000', opacity: 1 },
      },
    ]),
  )
  const saved = await request.put(`/api/slide-templates/${copy.id}`, {
    data: { layouts },
  })
  expect(saved.ok()).toBe(true)
  return copy
}

function screenCard(page: Page, screenId: number) {
  return page.locator(
    `[data-testid="screen-card"][data-screen-id="${screenId}"]`,
  )
}

test.describe('Slide templates', () => {
  test('the Templates page lists the built-in ones and who uses each', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, `E2E Tpl Screen ${Date.now()}`)
    try {
      await page.goto('/settings/templates')
      const cards = page.getByTestId('template-card')
      await expect(cards.first()).toBeVisible()
      // The screen's own template, named after it and used by it.
      const own = page.locator(
        `[data-testid="template-card"][data-template-id="${screen.templateId}"]`,
      )
      await expect(own).toBeVisible()
      await expect(own.getByTestId('template-thumbnail')).toBeVisible()
      // The four built-in designs, without rename or delete.
      for (const key of ['classic', 'stage', 'lower_third', 'kiosk']) {
        const bundled = (await templates(request)).find(
          (template) => template.bundledKey === key,
        ) as Template
        const card = page.locator(
          `[data-testid="template-card"][data-template-id="${bundled.id}"]`,
        )
        await expect(card).toBeVisible()
        await expect(
          card.getByRole('button', {
            name: label('presentation', 'templates.actions.delete'),
          }),
        ).toHaveCount(0)
      }
    } finally {
      await request.delete(`/api/screens/${screen.id}`)
    }
  })

  test('a screen picks another template in one choice and draws with it', async ({
    page,
    context,
    request,
  }) => {
    const name = `E2E Tpl Pick ${Date.now()}`
    const screen = await createScreen(request, name)
    const red = await redTemplate(request, `${name} red`)
    try {
      await page.goto('/settings/screens')
      const card = screenCard(page, screen.id)
      await card.getByTestId('screen-template-picker').click()
      await page.getByTestId(`template-choice-${red.id}`).click()
      await expect(card.getByTestId('screen-template-picker-value')).toHaveText(
        red.name,
      )
      const saved = (
        await (await request.get(`/api/screens/${screen.id}`)).json()
      ).data
      expect(saved.templateId).toBe(red.id)

      // The projection draws the template's background.
      const display = await context.newPage()
      await display.goto(`/screen/${screen.id}`)
      await expect
        .poll(() =>
          display.evaluate(() =>
            [...document.querySelectorAll('div')].some(
              (el) => getComputedStyle(el).backgroundColor === 'rgb(255, 0, 0)',
            ),
          ),
        )
        .toBe(true)

      // A template in use can't be deleted: the page says who uses it.
      await page.goto('/settings/templates')
      await page
        .locator(`[data-testid="template-card"][data-template-id="${red.id}"]`)
        .getByRole('button', {
          name: label('presentation', 'templates.actions.delete'),
        })
        .click()
      // "Used by <screen>": the alert, not the delete confirmation.
      await expect(page.locator('dialog[open]')).toContainText(`${name}:`)
      expect(
        (await request.delete(`/api/slide-templates/${red.id}`)).status(),
      ).toBe(409)
    } finally {
      await request.delete(`/api/screens/${screen.id}`)
      await request.delete(`/api/slide-templates/${red.id}`)
    }
  })

  test('a screen draws with another template while an OBS scene is live', async ({
    page,
    request,
  }) => {
    const name = `E2E Tpl Scene ${Date.now()}`
    const screen = await createScreen(request, name)
    const red = await redTemplate(request, `${name} red`)
    try {
      await page.goto('/settings/screens')
      const card = screenCard(page, screen.id)
      await card
        .getByTestId('screen-scene-templates')
        .locator('summary')
        .click()
      await card.getByTestId(`scene-template-picker-${SCENE}`).click()
      await page.getByTestId(`template-choice-${red.id}`).click()
      await expect
        .poll(
          async () =>
            (await (await request.get(`/api/screens/${screen.id}`)).json()).data
              .sceneTemplates,
        )
        .toEqual({ [SCENE]: red.id })

      // Back to the screen's own template.
      await card.getByTestId(`scene-template-picker-${SCENE}`).click()
      await page.getByTestId('template-choice-none').click()
      await expect
        .poll(
          async () =>
            (await (await request.get(`/api/screens/${screen.id}`)).json()).data
              .sceneTemplates,
        )
        .toEqual({})
    } finally {
      await request.delete(`/api/screens/${screen.id}`)
      await request.delete(`/api/slide-templates/${red.id}`)
    }
  })

  test('editing a built-in template saves a copy and leaves it as it was', async ({
    page,
    request,
  }) => {
    const before = await templates(request)
    const classic = before.find(
      (template) => template.bundledKey === 'classic',
    ) as Template
    await page.goto('/settings/templates')
    await page
      .locator(
        `[data-testid="template-card"][data-template-id="${classic.id}"]`,
      )
      .getByRole('button', {
        name: label('presentation', 'templates.actions.edit'),
      })
      .click()
    const save = page.getByTestId('screen-editor-save')
    await expect(save).toBeVisible()

    // A change: the song slide's clock on or off.
    await page
      .getByRole('switch')
      .filter({ hasNot: page.locator('[disabled]') })
      .first()
      .click()
    await save.click()

    await expect
      .poll(async () => (await templates(request)).length)
      .toBe(before.length + 1)
    const after = await templates(request)
    const copy = after.find(
      (template) => !before.some((old) => old.id === template.id),
    ) as Template
    expect(copy.bundledKey).toBeNull()
    expect(
      after.find((template) => template.id === classic.id)?.layouts,
    ).toEqual(classic.layouts)
    await request.delete(`/api/slide-templates/${copy.id}`)
  })
})
