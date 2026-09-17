import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The projection window's own keyboard.
 *
 * On a single monitor the projection is what holds the keyboard once it opens,
 * so it drives navigation itself rather than waiting to be handed back — and
 * two things stood between an operator and that working:
 *
 *   - the window is created and shown by the shell, and on Windows a fresh
 *     WebView2 window is focused without its web content being focused with it,
 *     so nothing reached the document until someone clicked inside it;
 *   - the control window has the F1-F11 browser defaults suppressed by the
 *     shell, but the projection windows never did — a presenter remote's F5
 *     "start" button reloaded the projector mid-service.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: [
        { content: 'First slide', sortOrder: 0 },
        { content: 'Second slide', sortOrder: 1 },
        { content: 'Third slide', sortOrder: 2 },
      ],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function liveSlideIndex(
  request: APIRequestContext,
): Promise<number | null> {
  const response = await request.get('/api/presentation/state')
  const { data } = await response.json()
  return data.temporaryContent?.type === 'song'
    ? (data.temporaryContent.data.currentSlideIndex as number)
    : null
}

async function firstScreenId(request: APIRequestContext) {
  const response = await request.get('/api/screens')
  const { data } = await response.json()
  return (data as Array<{ id: number }>)[0]?.id
}

interface LiveSong {
  songId: number
  currentSlideIndex: number
  scheduleId: number | undefined
  scheduleItemIndex: number | undefined
}

/** The song on the projector and its place in a program, or null. */
async function readLiveSong(
  request: APIRequestContext,
): Promise<LiveSong | null> {
  const response = await request.get('/api/presentation/state')
  const { data } = await response.json()
  const content = data.temporaryContent
  if (content?.type !== 'song') return null
  return {
    songId: content.data.songId,
    currentSlideIndex: content.data.currentSlideIndex,
    scheduleId: content.data.scheduleId,
    scheduleItemIndex: content.data.scheduleItemIndex,
  }
}

/**
 * A program of two three-slide songs. Its flat run: 0-2 the first song's
 * slides, 3-5 the second's.
 */
async function createTwoSongProgram(request: APIRequestContext, uniq: number) {
  const first = await createSong(request, `E2E Screen Program A ${uniq}`)
  const second = await createSong(request, `E2E Screen Program B ${uniq}`)
  const response = await request.post('/api/schedules', {
    data: { title: `E2E Screen Program ${uniq}` },
  })
  const schedule = (await response.json()).data as { id: number }
  for (const song of [first, second]) {
    const added = await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { songId: song.id },
    })
    expect(added.ok()).toBe(true)
  }
  return { first, second, scheduleId: schedule.id }
}

async function removeProgram(
  request: APIRequestContext,
  program: Awaited<ReturnType<typeof createTwoSongProgram>>,
) {
  await request.post('/api/presentation/clear-temporary').catch(() => {})
  await request.delete(`/api/schedules/${program.scheduleId}`).catch(() => {})
  await request.delete(`/api/songs/${program.first.id}`).catch(() => {})
  await request.delete(`/api/songs/${program.second.id}`).catch(() => {})
}

test.describe('The projection window holds its own keyboard', () => {
  test('the page takes the keyboard itself, without waiting for a click', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')

    await page.goto(`/screen/${screenId}`)
    await page.waitForLoadState('networkidle')

    // The projection's own root holds the focus, so a keystroke landing on
    // this window reaches the document rather than the empty native frame.
    await expect(page.getByTestId('screen-renderer-root')).toBeFocused()
  })

  test('arrows drive the slide with nothing on the page ever clicked', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const song = await createSong(request, `E2E Projection Keys ${Date.now()}`)

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id, slideIndex: 0 },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      // Up/Down as well as Left/Right — a remote's rocker sends either pair.
      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => liveSlideIndex(request), { timeout: 10000 })
        .toBe(1)
      await page.keyboard.press('ArrowUp')
      await expect.poll(() => liveSlideIndex(request)).toBe(0)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('a remote pressing F5 does not reload the projection', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const song = await createSong(request, `E2E Projection F5 ${Date.now()}`)

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id, slideIndex: 1 },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      // A marker only this document has: it does not survive a reload.
      await page.evaluate(() => {
        ;(window as unknown as Record<string, unknown>).__e2eAlive = true
      })

      await page.keyboard.press('F5')
      await page.waitForTimeout(1000)

      expect(
        await page.evaluate(
          () =>
            (window as unknown as Record<string, unknown>).__e2eAlive === true,
        ),
      ).toBe(true)
      // And it is not treated as a navigation key either.
      expect(await liveSlideIndex(request)).toBe(1)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})

/**
 * The projection window's arrows do what the control window's Next/Prev do.
 *
 * They used to move only within the item on screen: past a song's last slide
 * the projection went dark instead of carrying on into the program's next
 * item, because the program's running order lives in the control window and
 * the projection never had it.
 */
test.describe('The projection window walks a live program', () => {
  test('past the last slide the arrows cross into the next item and back', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const program = await createTwoSongProgram(request, Date.now())

    try {
      // The first song's last slide, as a step of the program.
      await request.post('/api/presentation/temporary-song', {
        data: {
          songId: program.first.id,
          slideIndex: 2,
          scheduleId: program.scheduleId,
          scheduleItemIndex: 2,
        },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('ArrowRight')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          songId: program.second.id,
          currentSlideIndex: 0,
          scheduleId: program.scheduleId,
          scheduleItemIndex: 3,
        })

      // And before the next item's first slide, back to the last slide of the
      // item before it.
      await page.keyboard.press('ArrowLeft')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          songId: program.first.id,
          currentSlideIndex: 2,
          scheduleId: program.scheduleId,
          scheduleItemIndex: 2,
        })
    } finally {
      await removeProgram(request, program)
    }
  })

  test('each press is one step, however fast they come', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const program = await createTwoSongProgram(request, Date.now())

    try {
      await request.post('/api/presentation/temporary-song', {
        data: {
          songId: program.first.id,
          slideIndex: 0,
          scheduleId: program.scheduleId,
          scheduleItemIndex: 0,
        },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      // Every program step the projection window asks for, in order.
      const requestedSteps: number[] = []
      page.on('request', (sent) => {
        if (!sent.url().endsWith('/api/presentation/temporary-song')) return
        requestedSteps.push(sent.postDataJSON().scheduleItemIndex)
      })

      // Pressed faster than the projector answers, like a held key.
      for (let press = 0; press < 4; press++) {
        await page.keyboard.press('ArrowRight')
      }

      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          songId: program.second.id,
          currentSlideIndex: 1,
          scheduleId: program.scheduleId,
          scheduleItemIndex: 4,
        })
      expect(requestedSteps).toEqual([1, 2, 3, 4])
    } finally {
      await removeProgram(request, program)
    }
  })

  test('a song up on its own still ends at its last slide', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const program = await createTwoSongProgram(request, Date.now())

    try {
      // The same song, presented on its own: no program is live, so there is
      // no next item to go on to.
      await request.post('/api/presentation/temporary-song', {
        data: { songId: program.first.id, slideIndex: 1 },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('ArrowRight')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          songId: program.first.id,
          currentSlideIndex: 2,
          scheduleId: undefined,
          scheduleItemIndex: undefined,
        })

      await page.keyboard.press('ArrowRight')
      await expect
        .poll(async () => {
          const response = await request.get('/api/presentation/state')
          const { data } = await response.json()
          return { content: data.temporaryContent, isHidden: data.isHidden }
        })
        .toEqual({ content: null, isHidden: true })
    } finally {
      await removeProgram(request, program)
    }
  })
})
