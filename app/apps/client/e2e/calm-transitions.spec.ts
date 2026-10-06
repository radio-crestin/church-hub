import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

/**
 * Calm factory transitions (T-112): every text element of every new screen
 * fades softly, eased at both ends, and the projected screen plays them so on
 * a verse change: the old verse eases out (300 ms), the new one eases in
 * (400 ms).
 */

const SCREEN_TYPES = ['primary', 'stage', 'livestream', 'kiosk'] as const
const CALM = {
  animationIn: 600,
  animationOut: 500,
  slideTransitionIn: 400,
  slideTransitionOut: 300,
}
const VERSES = [
  'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu.',
  'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea.',
]

interface Transition {
  type: string
  duration: number
  easing: string
}

async function createScreen(request: APIRequestContext, type: string) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Transitions ${type} ${Date.now()}`, type },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

function presentVerse(request: APIRequestContext, index: number) {
  return request.post('/api/presentation/temporary-bible', {
    data: {
      verseId: 9000 + index,
      reference: `Ioan 3:${16 + index}`,
      text: VERSES[index],
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: 15 + index,
    },
  })
}

/** Every inline CSS transition the page shows over the next `ms`. */
function collectTransitions(page: Page, ms: number) {
  return page.evaluate(
    (duration) =>
      new Promise<string[]>((resolve) => {
        const seen = new Set<string>()
        const end = performance.now() + duration
        const sample = () => {
          for (const element of document.querySelectorAll<HTMLElement>(
            '[style*="transition"]',
          )) {
            seen.add(element.style.transition)
          }
          if (performance.now() < end) requestAnimationFrame(sample)
          else resolve([...seen])
        }
        sample()
      }),
    ms,
  )
}

test.describe('Calm slide transitions', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  for (const type of SCREEN_TYPES) {
    test(`a new ${type} screen fades every text softly`, async ({
      request,
    }) => {
      const screen = await createScreen(request, type)
      created.push(screen.id)
      const response = await request.get(`/api/screens/${screen.id}`)
      const configs = (await response.json()).data.contentConfigs as Record<
        string,
        Record<string, Record<string, Transition> | unknown>
      >

      let checked = 0
      for (const [contentType, config] of Object.entries(configs)) {
        for (const [name, element] of Object.entries(config)) {
          const fields = element as Record<string, Transition> | null
          if (!fields?.animationIn) continue
          for (const [key, duration] of Object.entries(CALM)) {
            expect(fields[key], `${contentType}.${name}.${key}`).toEqual({
              type: 'fade',
              duration,
              delay: 0,
              easing: 'ease-in-out',
            })
          }
          checked++
        }
      }
      expect(checked).toBeGreaterThan(5)
    })
  }

  test('a verse change eases the old verse out and the new one in', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, 'primary')
    created.push(screen.id)
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()

    await page.goto(`/screen/${screen.id}`)
    await expect(page.getByText(VERSES[0]).last()).toBeVisible()

    const transitions = collectTransitions(page, 1500)
    expect((await presentVerse(request, 1)).ok()).toBeTruthy()
    const seen = (await transitions).join(' | ')

    expect(seen).toContain('300ms ease-in-out')
    expect(seen).toContain('400ms ease-in-out')
    await expect(page.getByText(VERSES[1]).last()).toBeVisible()
    await expect(page.getByText(VERSES[0])).toHaveCount(0)
  })
})
