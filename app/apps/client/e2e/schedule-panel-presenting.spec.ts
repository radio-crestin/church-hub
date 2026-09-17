import { expect, test } from '@playwright/test'

import { pressNavigationShortcut } from './helpers/navigation-shortcut'

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

/** The live song's slide and program position, or null when no song is up. */
async function readLiveSong(
  request: import('@playwright/test').APIRequestContext,
): Promise<{
  currentSlideIndex: number
  scheduleId: number | undefined
  scheduleItemIndex: number | undefined
} | null> {
  const res = await request.get('/api/presentation/state')
  const { data } = await res.json()
  const content = data?.temporaryContent
  if (content?.type !== 'song') return null
  return {
    currentSlideIndex: content.data.currentSlideIndex,
    scheduleId: content.data.scheduleId,
    scheduleItemIndex: content.data.scheduleItemIndex,
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

      // song (2 slides) → passage → announcement. A passage is ONE step: the
      // whole reading is a single Versete Biblice slide.
      // Flat run: 0 = slide 1, 1 = slide 2, 2 = the passage, 3 = the announcement.
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
      await expect(
        panel.getByTestId('schedule-versete-tineri-item'),
      ).toBeVisible()
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
        type: 'versete_tineri',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-versete-tineri-item',
        stepTestId: 'schedule-sub-item-2',
      })

      // The left rail has followed the projector out of the song: it now shows
      // the passage — and ONLY the passage — with the live verse ringed.
      const liveRail = page.getByTestId('schedule-live-item-panel')
      await expect(liveRail).toBeVisible({ timeout: 10000 })
      await expect(liveRail.getByTestId('schedule-sub-item-2')).toContainText(
        'Ioan 3:16',
      )
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
        type: 'versete_tineri',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-versete-tineri-item',
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
            // The passage is a `versete_tineri` slide too, so the marker has
            // to be read off the announcement itself.
            return data.items.find(
              (i: { itemType: string; slideType: string | null }) =>
                i.itemType === 'slide' && i.slideType === 'announcement',
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
              (i: { itemType: string; slideType: string | null }) =>
                i.itemType === 'slide' && i.slideType === 'announcement',
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

      // The panel grows the program through the add menu — the only "+" in the
      // header now that the green one-click add is gone.
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

      // song (2 slides) → passage. Flat run: 0 and 1 are the slides, 2 is the
      // passage, which is a single step.
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
        type: 'versete_tineri',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-versete-tineri-item',
      })

      // Scripture is a program step too, so the rail stays — now showing the
      // passage rather than the song's slides.
      await expect(liveRail).toBeVisible()
      await expect(liveRail.getByTestId('schedule-sub-item-2')).toContainText(
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

      // passage → announcement. Flat run: 0 = the passage (one step), 1 = the
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

      const passageRow = panel
        .getByTestId('schedule-versete-tineri-item')
        .first()
      await expect(passageRow).toBeVisible({ timeout: 10000 })

      // Compact rows here too — no inline verse list to expand.
      await expect(panel.getByTestId('schedule-item-expand')).toHaveCount(0)

      await passageRow.getByTestId('schedule-slide-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'versete_tineri',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-versete-tineri-item',
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

      // song (2 slides) → passage. Flat run: 0 and 1 are the slides, 2 is the
      // passage, which is a single step.
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
        type: 'versete_tineri',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-versete-tineri-item',
        stepTestId: 'schedule-sub-item-2',
      })
      const liveRail = page.getByTestId('schedule-live-item-panel')
      await expect(liveRail).toBeVisible({ timeout: 10000 })
      await expect(liveRail.getByTestId('schedule-sub-item-2')).toContainText(
        'Ioan 3:16',
      )
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the song page Next and Prev buttons walk a live program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Control Program ${uniq}`, 2)
    const schedule = await createSchedule(
      request,
      `E2E Control Program ${uniq}`,
    )

    try {
      // song (2 slides) → announcement. Flat run: 0 and 1 are the slides, 2 is
      // the announcement.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: `Anunt ${uniq}` },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'normal')
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

      // The program is selected but not on the projector, so a slide clicked on
      // the song page is the song on its own: no program step, no live row
      // (regression: it went up as the program's first step and lit the row).
      await page.getByTestId('song-slide-0').click()
      await expect
        .poll(() => readLiveStep(request), { timeout: 10000 })
        .toEqual({
          type: 'song',
          scheduleId: undefined,
          scheduleItemIndex: undefined,
        })
      await expect(page.getByTestId('song-slide-0')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )
      await expect(panel.getByTestId('schedule-song-item')).not.toHaveClass(
        /ring-orange-500/,
      )

      // Started from its row, the program is live, and its first slide is the
      // program's first step.
      await panel.getByTestId('schedule-song-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-0',
      })

      // The buttons walk the program, like the arrow keys: the cursor moves
      // with every slide, and past the song's last one comes the announcement
      // (regression: the buttons moved only the song and left the program's
      // cursor behind, so Next on the last slide ended the presentation).
      const next = page.getByTestId('song-control-next')
      await next.click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-1',
      })
      await next.click()
      await expectLiveStep(request, page, panel, {
        type: 'announcement',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-announcement-item',
      })

      await page.getByTestId('song-control-prev').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
        stepTestId: 'song-slide-1',
      })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('configured Next/Prev shortcuts walk the live program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Shortcut Program ${uniq}`, 2)
    const schedule = await createSchedule(
      request,
      `E2E Shortcut Program ${uniq}`,
    )

    try {
      // song (2 slides) → announcement. Flat run: 0 and 1 are the slides, 2 is
      // the announcement.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: `Anunt ${uniq}` },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
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
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })

      await panel.getByTestId('schedule-song-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
      })

      // On the song page the shortcut is the stage's Next: it walks the
      // program, and past the song's last slide comes the announcement
      // (regression: the shortcut moved only the song and ended it there).
      await pressNavigationShortcut(page, 'next', 'F2')
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
      })
      await pressNavigationShortcut(page, 'next', 'F2')
      await expectLiveStep(request, page, panel, {
        type: 'announcement',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-announcement-item',
      })

      // A page with no running order of its own walks the live program too,
      // back into the song's last slide.
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      await pressNavigationShortcut(page, 'prev', 'F1')
      await expect
        .poll(() => readLiveStep(request), { timeout: 10000 })
        .toEqual({
          type: 'song',
          scheduleId: schedule.id,
          scheduleItemIndex: 1,
        })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the PowerPoint stage keeps a live program on course', async ({
    page,
    context,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Stage Program ${uniq}`, 3)
    const schedule = await createSchedule(request, `E2E Stage Program ${uniq}`)

    try {
      // song (3 slides) → announcement. Flat run: 0-2 are the slides, 3 is the
      // announcement.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: `Anunt ${uniq}` },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
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
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(3, { timeout: 10000 })

      // Present with the program selected but idle is the song on its own:
      // no program step and no live row, and a quick run of key presses moves
      // the song one slide per press (regression: it went up as the program's
      // step, and presses made before the projector answered were lost).
      await page.getByTestId('stage-present').click()
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 2,
          scheduleId: undefined,
          scheduleItemIndex: undefined,
        })
      await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
      await expect(page.getByTestId('stage-hide')).toBeVisible()
      await expect(panel.getByTestId('schedule-song-item')).not.toHaveClass(
        /ring-orange-500/,
      )

      // Started from its row, the program is on the projector.
      await panel.getByTestId('schedule-song-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
      })

      // The stage's green button puts slide 2 up as a step of the program, so
      // the program keeps its place (regression: it went up as a lone song and
      // the program lost track of what was on screen).
      await page.getByTestId('thumb-project').nth(1).click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 1,
        rowTestId: 'schedule-song-item',
      })

      // The program page carries on from there with slide 3 — not from the top.
      const programPage = await context.newPage()
      await programPage.goto(`/schedules/${schedule.id}`)
      await programPage.waitForLoadState('networkidle')
      await expect(programPage.getByTestId('schedule-sub-item-1')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )
      await programPage.keyboard.press('ArrowRight')
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 2,
        rowTestId: 'schedule-song-item',
      })
      await programPage.close()

      // The stage's own Next walks the program too: past the song's last slide
      // comes the announcement, and the stage stays on the slide it showed.
      await thumbs.nth(1).click()
      await page.getByTestId('stage-next').click()
      await expectLiveStep(request, page, panel, {
        type: 'announcement',
        scheduleId: schedule.id,
        scheduleItemIndex: 3,
        rowTestId: 'schedule-announcement-item',
      })
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test("a live program's row stays on the song the projector shows", async ({
    page,
    context,
    request,
  }) => {
    const screens = await (await request.get('/api/screens')).json()
    const screenId = (screens.data as Array<{ id: number }>)[0]?.id
    test.skip(!screenId, 'no screens configured')

    const uniq = Date.now()
    const first = await createSong(request, `E2E Row First ${uniq}`, 3)
    const second = await createSong(request, `E2E Row Second ${uniq}`, 3)
    const schedule = await createSchedule(request, `E2E Row Prog ${uniq}`)

    try {
      // Two songs of three slides. Flat run: 0-2 the first song, 3-5 the second.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: first.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: second.id },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${second.id}`)
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      const firstRow = panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: first.title })
      const secondRow = panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: second.title })
      await expect(secondRow).toBeVisible({ timeout: 10000 })
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(3, { timeout: 10000 })

      await secondRow.getByTestId('schedule-song-present').click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 0,
          scheduleId: schedule.id,
          scheduleItemIndex: 3,
        })

      // Down on the projection window, which answers the keys itself once it
      // holds the keyboard: the song moves on, and so does its program step.
      const projection = await context.newPage()
      await projection.goto(`/screen/${screenId}`)
      await projection.waitForLoadState('networkidle')
      await projection.keyboard.press('ArrowDown')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toMatchObject({ currentSlideIndex: 1, scheduleItemIndex: 4 })
      await projection.keyboard.press('ArrowDown')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 2,
          scheduleId: schedule.id,
          scheduleItemIndex: 5,
        })

      // The program page rings the verse the projector shows.
      const programPage = await context.newPage()
      await programPage.goto(`/schedules/${schedule.id}`)
      await programPage.waitForLoadState('networkidle')
      await expect(programPage.getByTestId('schedule-sub-item-5')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )
      await programPage.close()
      await projection.close()

      // Back up to the second song's first slide from the stage: the program
      // walks back through that song, and its row keeps the live ring
      // (regression: the first Up jumped to the first song's last slide, whose
      // row took the ring, and the stage lost its Hide button).
      await page.bringToFront()
      await page.keyboard.press('ArrowUp')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toMatchObject({ currentSlideIndex: 1, scheduleItemIndex: 4 })
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await page.keyboard.press('ArrowUp')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 0,
          scheduleId: schedule.id,
          scheduleItemIndex: 3,
        })
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')
      await expect(secondRow).toHaveClass(/ring-orange-500/)
      await expect(firstRow).not.toHaveClass(/ring-orange-500/)
      await expect(page.getByTestId('stage-hide')).toBeVisible()
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${first.id}`).catch(() => {})
      await request.delete(`/api/songs/${second.id}`).catch(() => {})
    }
  })

  test('each key press walks a live program exactly one step, in order', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Rapid Program ${uniq}`, 10)
    const schedule = await createSchedule(request, `E2E Rapid Program ${uniq}`)

    try {
      // song (10 slides) → announcement. Flat run: 0-9 the slides, 10 the
      // announcement.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: song.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: `Anunt ${uniq}` },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
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
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(10, { timeout: 10000 })

      // Every program step the page asks the projector for, in order.
      const requestedSteps: number[] = []
      page.on('request', (sent) => {
        if (!sent.url().endsWith('/api/presentation/temporary-song')) return
        requestedSteps.push(sent.postDataJSON().scheduleItemIndex)
      })

      await panel.getByTestId('schedule-song-present').click()
      await expectLiveStep(request, page, panel, {
        type: 'song',
        scheduleId: schedule.id,
        scheduleItemIndex: 0,
        rowTestId: 'schedule-song-item',
      })

      // Pressed faster than the projector answers, like a held key.
      for (let press = 0; press < 4; press++) {
        await page.keyboard.press('ArrowDown')
      }
      // A configured shortcut on a key the page binds too can arrive both ways
      // for one press — as the key, and as the shortcut under whichever name it
      // was stored with. Still one step each (regression: "Down" stored for
      // the arrow did not match the page's "ArrowDown" and moved two).
      for (let press = 0; press < 2; press++) {
        await page.keyboard.press('PageDown')
        await pressNavigationShortcut(page, 'next', 'PageDown')
      }
      await page.keyboard.press('ArrowDown')
      await pressNavigationShortcut(page, 'next', 'Down')
      await page.keyboard.press('ControlOrMeta+ArrowRight')
      await pressNavigationShortcut(page, 'next', 'CmdOrCtrl+Right')

      await expect
        .poll(() => readLiveStep(request), { timeout: 10000 })
        .toEqual({
          type: 'song',
          scheduleId: schedule.id,
          scheduleItemIndex: 8,
        })
      await expect(thumbs.nth(8)).toHaveAttribute('aria-current', 'true')
      expect(requestedSteps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
      await expect(page.getByTestId('stage-hide')).toBeVisible()
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})

/**
 * Presents one slide of a song from the song page while its program is idle —
 * which puts the song up on its own, as no step of the program.
 */
async function presentSongOnItsOwn(
  request: import('@playwright/test').APIRequestContext,
  page: import('@playwright/test').Page,
  songId: number,
  slideIndex: number,
): Promise<void> {
  // A live program would claim the song as its step; idle, it cannot.
  await request.post('/api/presentation/clear-temporary')
  await page.goto(`/songs/${songId}`)
  await page.waitForLoadState('networkidle')
  await page.getByTestId(`song-slide-${slideIndex}`).click()
  await expect
    .poll(() => readLiveSong(request), { timeout: 10000 })
    .toEqual({
      currentSlideIndex: slideIndex,
      scheduleId: undefined,
      scheduleItemIndex: undefined,
    })
}

/**
 * Opens the program page and waits until it shows the song on the projector,
 * so Next and Prev are judged against what is on screen.
 */
async function openProgramPage(
  page: import('@playwright/test').Page,
  scheduleId: number,
  liveSongTitle: string,
): Promise<void> {
  await page.goto(`/schedules/${scheduleId}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByTitle(liveSongTitle, { exact: true })).toBeVisible({
    timeout: 10000,
  })
}

test.describe("a program's Next and Prev carry on from the song on screen", () => {
  /**
   * Two songs of three slides, then an announcement. Flat run: 0-2 the first
   * song, 3-5 the second, 6 the announcement.
   */
  async function createProgram(
    request: import('@playwright/test').APIRequestContext,
    label: string,
  ) {
    const uniq = Date.now()
    const first = await createSong(request, `E2E ${label} First ${uniq}`, 3)
    const second = await createSong(request, `E2E ${label} Second ${uniq}`, 3)
    const schedule = await createSchedule(request, `E2E ${label} ${uniq}`)
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { songId: first.id },
    })
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { songId: second.id },
    })
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'announcement', slideContent: `Anunt ${uniq}` },
    })
    return { first, second, schedule }
  }

  async function removeProgram(
    request: import('@playwright/test').APIRequestContext,
    program: Awaited<ReturnType<typeof createProgram>>,
  ) {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request
      .delete(`/api/schedules/${program.schedule.id}`)
      .catch(() => {})
    await request.delete(`/api/songs/${program.first.id}`).catch(() => {})
    await request.delete(`/api/songs/${program.second.id}`).catch(() => {})
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
  })

  test("the program page's Next and Prev buttons move on from the song on screen", async ({
    page,
    request,
  }) => {
    const program = await createProgram(request, 'Prog Buttons')
    const { second, schedule } = program

    try {
      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'normal')
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)

      await presentSongOnItsOwn(request, page, second.id, 0)
      // Presenting it did not start the program: its row stays unlit.
      const panel = page.getByTestId('schedule-songs-panel')
      await expect(
        panel
          .getByTestId('schedule-song-item')
          .filter({ hasText: second.title }),
      ).not.toHaveClass(/ring-orange-500/)

      // Next is the second song's next slide, as a step of the program, and the
      // program lights it (regression: the first song's first slide went up).
      await openProgramPage(page, schedule.id, second.title)
      await page.getByTestId('schedule-preview-next').click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 1,
          scheduleId: schedule.id,
          scheduleItemIndex: 4,
        })
      await expect(page.getByTestId('schedule-sub-item-4')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )

      // From the song's last slide, Next is the item after the song.
      await presentSongOnItsOwn(request, page, second.id, 2)
      await openProgramPage(page, schedule.id, second.title)
      await page.getByTestId('schedule-preview-next').click()
      await expect
        .poll(() => readLiveStep(request), { timeout: 10000 })
        .toEqual({
          type: 'announcement',
          scheduleId: schedule.id,
          scheduleItemIndex: 6,
        })

      // Prev from the song's first slide is the last slide of the song before
      // it (regression: Prev stayed disabled).
      await presentSongOnItsOwn(request, page, second.id, 0)
      await openProgramPage(page, schedule.id, second.title)
      const prev = page.getByTestId('schedule-preview-prev')
      await expect(prev).toBeEnabled()
      await prev.click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 2,
          scheduleId: schedule.id,
          scheduleItemIndex: 2,
        })
      await expect(page.getByTestId('schedule-sub-item-2')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )
    } finally {
      await removeProgram(request, program)
    }
  })

  test("the program page's keys and shortcuts move on from the song on screen", async ({
    page,
    request,
  }) => {
    const program = await createProgram(request, 'Prog Keys')
    const { second, schedule } = program

    try {
      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'normal')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)

      // A key (or a presenter remote's page key) goes on to the song's next
      // slide as a program step (regression: it did nothing).
      await presentSongOnItsOwn(request, page, second.id, 1)
      await openProgramPage(page, schedule.id, second.title)
      await page.keyboard.press('ArrowRight')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 2,
          scheduleId: schedule.id,
          scheduleItemIndex: 5,
        })
      await expect(page.getByTestId('schedule-sub-item-5')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )

      // A configured Next shortcut does the same.
      await presentSongOnItsOwn(request, page, second.id, 0)
      await openProgramPage(page, schedule.id, second.title)
      await pressNavigationShortcut(page, 'next', 'F2')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 1,
          scheduleId: schedule.id,
          scheduleItemIndex: 4,
        })

      // Back from the song's first slide is the song before it.
      await presentSongOnItsOwn(request, page, second.id, 0)
      await openProgramPage(page, schedule.id, second.title)
      await page.keyboard.press('ArrowLeft')
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 2,
          scheduleId: schedule.id,
          scheduleItemIndex: 2,
        })
    } finally {
      await removeProgram(request, program)
    }
  })

  test('a song the program holds twice carries on where the program had reached', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const opening = await createSong(request, `E2E Twice Opening ${uniq}`, 3)
    const middle = await createSong(request, `E2E Twice Middle ${uniq}`, 3)
    const schedule = await createSchedule(request, `E2E Twice ${uniq}`)

    try {
      // The same song opens and closes the service. Flat run: 0-2 the opening
      // song, 3-5 the middle one, 6-8 the opening song again.
      for (const songId of [opening.id, middle.id, opening.id]) {
        await request.post(`/api/schedules/${schedule.id}/items`, {
          data: { songId },
        })
      }

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-editor-layout', 'normal')
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.goto(`/songs/${middle.id}`)
      await page.waitForLoadState('networkidle')
      const panel = page.getByTestId('schedule-songs-panel')
      const middleRow = panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: middle.title })
      await expect(middleRow).toBeVisible({ timeout: 10000 })

      // The program runs up to the middle song, then the projection is
      // cleared — the program is idle, but it had got that far.
      await middleRow.getByTestId('schedule-song-present').click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 0,
          scheduleId: schedule.id,
          scheduleItemIndex: 3,
        })
      await expect(middleRow).toHaveClass(/ring-orange-500/, {
        timeout: 10000,
      })
      await request.post('/api/presentation/clear-temporary')
      await expect(middleRow).not.toHaveClass(/ring-orange-500/, {
        timeout: 10000,
      })

      // Without leaving the app: the closing song goes up on its own, then
      // the program page is opened.
      await panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: opening.title })
        .last()
        .getByTestId('schedule-song-open')
        .click()
      await expect(page).toHaveURL(new RegExp(`/songs/${opening.id}`))
      await page.getByTestId('song-slide-0').click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 0,
          scheduleId: undefined,
          scheduleItemIndex: undefined,
        })
      await panel.getByTestId('schedule-open').click()
      await expect(page).toHaveURL(new RegExp(`/schedules/${schedule.id}`))
      await expect(page.getByTitle(opening.title, { exact: true })).toBeVisible(
        { timeout: 10000 },
      )

      // Next continues the closing occurrence, past where the program was.
      await page.getByTestId('schedule-preview-next').click()
      await expect
        .poll(() => readLiveSong(request), { timeout: 10000 })
        .toEqual({
          currentSlideIndex: 1,
          scheduleId: schedule.id,
          scheduleItemIndex: 7,
        })
      await expect(page.getByTestId('schedule-sub-item-7')).toHaveClass(
        /ring-green-500/,
        { timeout: 10000 },
      )
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${opening.id}`).catch(() => {})
      await request.delete(`/api/songs/${middle.id}`).catch(() => {})
    }
  })
})
