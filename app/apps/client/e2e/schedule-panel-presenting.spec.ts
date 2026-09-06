import { expect, test } from '@playwright/test'

/**
 * The Programe panel on the Songs and Bible pages runs a program the same way
 * the program page does: every kind of item shows up, each opens to its
 * presentable steps, clicking a step projects it as a step OF THE PROGRAM, and
 * next carries on across item boundaries — song slides → passage verses →
 * announcement.
 */

interface CreatedSong {
  id: number
  title: string
}

async function createSong(
  request: import('@playwright/test').APIRequestContext,
  title: string,
  slideCount = 2,
): Promise<CreatedSong> {
  const res = await request.post('/api/songs', {
    data: {
      title,
      slides: Array.from({ length: slideCount }, (_, i) => ({
        content: `${title} slide ${i + 1}`,
        sortOrder: i,
      })),
    },
  })
  const { data } = await res.json()
  return data
}

async function createSchedule(
  request: import('@playwright/test').APIRequestContext,
  title: string,
): Promise<{ id: number; title: string }> {
  const res = await request.post('/api/schedules', { data: { title } })
  const { data } = await res.json()
  return data
}

/** The live projection, reduced to what these assertions care about. */
async function readLiveStep(
  request: import('@playwright/test').APIRequestContext,
): Promise<{
  type: string | undefined
  scheduleId: number | undefined
  scheduleItemIndex: number | undefined
}> {
  const res = await request.get('/api/presentation/state')
  const { data } = await res.json()
  return {
    type: data?.temporaryContent?.type,
    scheduleId: data?.temporaryContent?.data?.scheduleId,
    scheduleItemIndex: data?.temporaryContent?.data?.scheduleItemIndex,
  }
}

/**
 * Asserts the program step that is live, on the server AND in the panel.
 *
 * Waiting for the live row's ring matters beyond the highlight itself: it
 * proves the page has caught up with the projector, so the next key press is
 * judged against the step that is actually up rather than the one before it.
 */
async function expectLiveStep(
  request: import('@playwright/test').APIRequestContext,
  page: import('@playwright/test').Page,
  panel: import('@playwright/test').Locator,
  expected: {
    type: string
    scheduleId: number
    scheduleItemIndex: number
    /** The panel row that should carry the live ring. */
    rowTestId: string
    /**
     * The left-rail step that should be ringed green. Load-bearing wherever
     * two consecutive steps live in the SAME item: the panel row's ring does
     * not change between them, so settling on it alone would let the next key
     * press read a stale cursor. Omitted where every step changes row (the
     * Bible page, which has no rail).
     */
    stepTestId?: string
  },
): Promise<void> {
  const { rowTestId, stepTestId, ...liveStep } = expected
  await expect
    .poll(() => readLiveStep(request), { timeout: 10000 })
    .toEqual(liveStep)
  await expect(panel.getByTestId(rowTestId).first()).toHaveClass(
    /ring-orange-500/,
    { timeout: 10000 },
  )
  if (stepTestId) {
    await expect(page.getByTestId(stepTestId)).toHaveClass(/ring-green-500/, {
      timeout: 10000,
    })
  }
}

test.describe('Programe panel presents and advances the program', () => {
  test('the song page runs the whole program, crossing item boundaries', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Present Song ${uniq}`, 2)
    const schedule = await createSchedule(request, `E2E Present Prog ${uniq}`)

    try {
      const translations = await request.get('/api/bible/translations')
      const translation = (await translations.json()).data?.[0]
      // Hard assertion rather than a conditional skip: a missing translation
      // means the seed is broken, and silently skipping would hide it.
      expect(translation).toBeTruthy()

      // song (2 slides) → passage (1 verse) → announcement.
      // Flat run: 0 = slide 1, 1 = slide 2, 2 = the verse, 3 = the announcement.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      const passage = await request.post(
        `/api/schedules/${schedule.id}/items`,
        {
          data: {
            biblePassage: {
              translationId: translation.id,
              translationAbbreviation: translation.abbreviation,
              bookCode: 'JHN',
              bookName: 'Ioan',
              startChapter: 3,
              startVerse: 16,
              endChapter: 3,
              endVerse: 16,
            },
          },
        },
      )
      expect(passage.status()).toBe(201)
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: 'Anunt E2E' },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })

      // Every kind is listed, each as one compact row — the announcement rides
      // along even though it is neither a song nor a passage.
      await expect(panel.getByTestId('schedule-song-item')).toBeVisible({
        timeout: 10000,
      })
      await expect(panel.getByTestId('schedule-verse-item')).toBeVisible()
      await expect(
        panel.getByTestId('schedule-announcement-item'),
      ).toBeVisible()
      // The panel no longer expands: verses are picked on the left.
      await expect(panel.getByTestId('schedule-item-expand')).toHaveCount(0)
      await expect(panel.getByTestId('schedule-sub-item-0')).toHaveCount(0)

      // Clicking a row puts that item on screen from its FIRST step.
      await panel.getByTestId('schedule-song-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-0',
      })

      // Individual slides are chosen on the left rail — and because this song
      // belongs to the program, the click lands as a program step.
      await page.getByTestId('song-slide-1').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-1',
      })

      // Next crosses out of the song into the passage that follows it.
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'bible_passage',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-verse-item',
        stepTestId: 'schedule-sub-item-2',
      })

      // The left rail has followed the projector out of the song: it now shows
      // the passage — and ONLY the passage — with the live verse ringed.
      const liveRail = page.getByTestId('schedule-live-item-panel')
      await expect(liveRail).toBeVisible({ timeout: 10000 })
      await expect(
        liveRail.getByTestId('schedule-live-item-title'),
      ).toContainText('Ioan 3:16')
      await expect(liveRail.getByTestId('schedule-sub-item-2')).toHaveClass(
        /ring-green-500/,
      )
      await expect(liveRail.getByTestId('schedule-sub-item-0')).toHaveCount(0)
      // The song's own verse list is no longer what the rail is showing.
      await expect(page.getByTestId('song-slide-0')).toHaveCount(0)

      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'announcement',
        scheduleId: schedule.id,
        scheduleItemIndex: 3,
        rowTestId: 'schedule-announcement-item',
        stepTestId: 'schedule-sub-item-3',
      })

      // And back again, into the passage the announcement followed.
      await page.keyboard.press('ArrowLeft')
      await expectLiveStep(request, page, panel, {
        type: 'bible_passage',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-verse-item',
        stepTestId: 'schedule-sub-item-2',
      })

      // Back onto a slide of the open song, the rail returns to the song's own
      // verse list (the one that carries edit mode and the font controls).
      await page.keyboard.press('ArrowLeft')
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-1',
      })
      await expect(liveRail).toHaveCount(0)
      await expect(page.getByTestId('song-slide-1')).toBeVisible()

      // Every kind carries the done-marker, announcements included.
      await panel
        .getByTestId('schedule-announcement-item')
        .getByTestId('schedule-slide-sung-toggle')
        .click()
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.find(
              (i: { itemType: string }) => i.itemType === 'slide',
            )?.isSung
          },
          { timeout: 10000 },
        )
        .toBe(true)
      // Full item management from the panel: edit the announcement through the
      // program page's own slide editor, then drop it from the program.
      await panel
        .getByTestId('schedule-announcement-item')
        .getByTestId('schedule-slide-edit')
        .click()
      const slideEditor = page.getByTestId('insert-slide-modal')
      await expect(slideEditor).toBeVisible({ timeout: 10000 })
      // The announcement body is a rich-text editor, so it is typed into.
      const slideBody = slideEditor
        .getByTestId('insert-slide-content')
        .locator('[contenteditable="true"]')
      await slideBody.click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type(`Anunt editat ${uniq}`)
      await slideEditor.getByTestId('insert-slide-save').click()
      await expect(slideEditor).toBeHidden({ timeout: 10000 })
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.find(
              (i: { itemType: string }) => i.itemType === 'slide',
            )?.slideContent
          },
          { timeout: 10000 },
        )
        .toContain(`Anunt editat ${uniq}`)

      await panel
        .getByTestId('schedule-announcement-item')
        .getByTestId('schedule-slide-remove')
        .click()
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.length
          },
          { timeout: 10000 },
        )
        .toBe(2)

      // The panel can also grow the program: the quick "+" appends the song the
      // page has open, and the full add menu is the program page's own.
      await panel.getByTestId('schedule-add-candidate-song').click()
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.length
          },
          { timeout: 10000 },
        )
        .toBe(3)

      await panel.getByTestId('schedule-add-item').click()
      await expect(page.getByTestId('add-schedule-item-modal')).toBeVisible({
        timeout: 10000,
      })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('a live program step takes over the Bible page, and can be dismissed there', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Bible Takeover ${uniq}`, 2)
    const schedule = await createSchedule(request, `E2E Bible Takeover ${uniq}`)

    try {
      const translations = await request.get('/api/bible/translations')
      const translation = (await translations.json()).data?.[0]
      expect(translation).toBeTruthy()

      // song (2 slides) → passage (1 verse). Flat run: 0 and 1 are the slides,
      // 2 is the verse.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      const passage = await request.post(
        `/api/schedules/${schedule.id}/items`,
        {
          data: {
            biblePassage: {
              translationId: translation.id,
              translationAbbreviation: translation.abbreviation,
              bookCode: 'JHN',
              bookName: 'Ioan',
              startChapter: 3,
              startVerse: 16,
              endChapter: 3,
              endVerse: 16,
            },
          },
        },
      )
      expect(passage.status()).toBe(201)

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('bible:programs-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/bible')
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })

      // Nothing is live yet, so the main column is the Bible, as always.
      const mainColumn = page.getByTestId('workspace-panel-navigation')
      const liveRail = mainColumn.getByTestId('schedule-live-item-panel')
      await expect(liveRail).toHaveCount(0)

      await panel.getByTestId('schedule-song-present').click()
      // Both slides live in the SAME program row, so the row's ring cannot say
      // which of them is up: settle on the rail's step instead, or the next key
      // press reads a stale cursor and re-presents the slide already showing.
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
        stepTestId: 'schedule-sub-item-0',
      })

      // The song is on the projector, so it is what the page shows — the same
      // rail the song page uses, so the running order reads identically
      // wherever the operator is standing.
      await expect(liveRail).toBeVisible({ timeout: 10000 })
      await expect(liveRail.getByTestId('schedule-live-item-title')).toHaveText(
        song.title,
      )

      // Walk out of the song and into the passage.
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'schedule-sub-item-1',
      })
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'bible_passage',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-verse-item',
      })

      // Scripture is a program step too, so the rail stays — now showing the
      // passage's verses rather than the song's slides.
      await expect(liveRail).toBeVisible()
      await expect(liveRail.getByTestId('schedule-live-item-title')).toHaveText(
        /Ioan/,
      )

      // Leaving the program is done from the rail itself, not from the
      // preview: the column goes back to the Bible.
      await liveRail.getByTestId('schedule-live-item-stop').click()
      await expect(liveRail).toHaveCount(0)
      await expect
        .poll(() => readLiveStep(request), { timeout: 10000 })
        .toEqual({
          type: undefined,
          scheduleId: undefined,
          scheduleItemIndex: undefined,
        })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the Bible page presents from the panel and advances the program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(request, `E2E Bible Present ${uniq}`)

    try {
      const translations = await request.get('/api/bible/translations')
      const translation = (await translations.json()).data?.[0]
      // Hard assertion rather than a conditional skip: a missing translation
      // means the seed is broken, and silently skipping would hide it.
      expect(translation).toBeTruthy()

      // passage (1 verse) → announcement. Flat run: 0 = the verse, 1 = the
      // announcement.
      const passage = await request.post(
        `/api/schedules/${schedule.id}/items`,
        {
          data: {
            biblePassage: {
              translationId: translation.id,
              translationAbbreviation: translation.abbreviation,
              bookCode: 'JHN',
              bookName: 'Ioan',
              startChapter: 3,
              startVerse: 16,
              endChapter: 3,
              endVerse: 16,
            },
          },
        },
      )
      expect(passage.status()).toBe(201)
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: 'Anunt Biblie E2E' },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('bible-history-collapsed', 'false')
        window.localStorage.setItem('bible:programs-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/bible')
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })

      const verseRow = panel.getByTestId('schedule-verse-item').first()
      await expect(verseRow).toBeVisible({ timeout: 10000 })

      // Compact rows here too — no inline verse list to expand.
      await expect(panel.getByTestId('schedule-item-expand')).toHaveCount(0)

      await verseRow.getByTestId('schedule-verse-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'bible_passage',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-verse-item',
      })

      // On the Bible page the panel is the running order and next/prev is how
      // the operator moves through it — there is no live rail here.
      // Next leaves the passage behind and shows the program's announcement.
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'announcement',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-announcement-item',
      })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
    }
  })

  test('the song list follows the projector onto the song it just presented', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E List Follow ${uniq}`, 2)
    const schedule = await createSchedule(request, `E2E List Follow ${uniq}`)

    try {
      const translations = await request.get('/api/bible/translations')
      const translation = (await translations.json()).data?.[0]
      expect(translation).toBeTruthy()

      // song (2 slides) → passage (1 verse). Flat run: 0 and 1 are the slides,
      // 2 is the verse.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      const passage = await request.post(
        `/api/schedules/${schedule.id}/items`,
        {
          data: {
            biblePassage: {
              translationId: translation.id,
              translationAbbreviation: translation.abbreviation,
              bookCode: 'JHN',
              bookName: 'Ioan',
              startChapter: 3,
              startVerse: 16,
              endChapter: 3,
              endVerse: 16,
            },
          },
        },
      )
      expect(passage.status()).toBe(201)

      // The panel has to be open on BOTH pages: the list is where the row is
      // clicked, the song page is where the live ring is then read.
      //
      // The remembered last-visited song is load-bearing, not decoration: the
      // list's one-shot "open on the presented song" effect only spends itself
      // when it has something to act on, and a list opened with nothing
      // remembered would still be armed — it would then follow the projector
      // on its own and hide a regression here. Seeding it puts the test in the
      // operator's real position: the list has already settled, and the only
      // thing that can take them to the song is the row click itself.
      await page.addInitScript(
        ({ scheduleId, songId }: { scheduleId: number; songId: number }) => {
          window.localStorage.setItem('songs-list:schedules-open', 'true')
          window.localStorage.setItem('song-detail:schedules-open', 'true')
          window.localStorage.setItem(
            'songPage.selectedScheduleId',
            String(scheduleId),
          )
          window.localStorage.setItem(
            'church-hub-last-visited',
            JSON.stringify({ songs: { songId } }),
          )
        },
        { scheduleId: schedule.id, songId: song.id },
      )
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/songs')
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })

      // Clicking the row body on the LIST projects the song AND opens it, so
      // the operator lands on the slide rail rather than being left behind on
      // the list with the program already running.
      await panel.getByTestId('schedule-song-present').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${song.id}(\\?|$)`), {
        timeout: 10000,
      })

      // The row's orange ring is gated on the page deriving schedule mode
      // (SchedulePanel only trusts the projector's step while the live content
      // carries the selected program), so this IS the schedule-mode assertion.
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-0',
      })

      // And the arrows now walk the PROGRAM, not just this song: past its last
      // slide they cross into the passage that follows it.
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-1',
      })
      await page.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'bible_passage',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-verse-item',
        stepTestId: 'schedule-sub-item-2',
      })
      const liveRail = page.getByTestId('schedule-live-item-panel')
      await expect(liveRail).toBeVisible({ timeout: 10000 })
      await expect(
        liveRail.getByTestId('schedule-live-item-title'),
      ).toContainText('Ioan 3:16')
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
