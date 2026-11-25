import { type APIRequestContext, expect, test } from '@playwright/test'

import { startFakeAudioServer } from './helpers/fake-audio'
import { buildMidiFile } from './helpers/midi-file'

/**
 * MIDI music with synced verses (T-185): a song item of a presentation gets
 * a MIDI file; when the run reaches it the music plays (rendered with the
 * bundled SoundFont, through the music player) and each verse goes up at its
 * time in the music: split evenly, or as synced by tapping along.
 */

const MIDI_SECONDS = 6
const VERSES = ['Prima strofă', 'A doua strofă', 'A treia strofă']

let stopFakeAudio: (() => void) | undefined
test.beforeAll(async () => {
  stopFakeAudio = await startFakeAudioServer()
})
test.afterAll(() => stopFakeAudio?.())

async function createMidiPresentation(request: APIRequestContext) {
  const title = `E2E MIDI ${Date.now()}`
  const song = await request.post('/api/songs', {
    data: {
      title,
      slides: VERSES.map((content, sortOrder) => ({
        content,
        sortOrder,
        label: `V${sortOrder + 1}`,
      })),
    },
  })
  expect(song.status()).toBe(201)
  const songId: number = (await song.json()).data.id
  const schedule = await request.post('/api/schedules', { data: { title } })
  const id: number = (await schedule.json()).data.id
  const item = await request.post(`/api/schedules/${id}/items`, {
    data: { songId },
  })
  const itemId: number = (await item.json()).data.id
  await request.post(`/api/schedules/${id}/items`, {
    data: { slideType: 'announcement', slideContent: '<p>Bun venit!</p>' },
  })
  return { id, itemId, songId, title }
}

function uploadMidi(
  request: APIRequestContext,
  id: number,
  itemId: number,
  body: Buffer,
) {
  return request.put(
    `/api/schedules/${id}/items/${itemId}/midi?name=intro.mid`,
    {
      headers: { 'Content-Type': 'audio/midi' },
      data: body,
    },
  )
}

/** The step on screen: its position in the presentation, or null. */
async function liveStep(request: APIRequestContext): Promise<number | null> {
  const res = await request.get('/api/presentation/state')
  const data = (await res.json()).data?.temporaryContent?.data
  return data?.scheduleItemIndex ?? null
}

/** Seconds since `start` at which each step first came on screen. */
async function watchSteps(
  request: APIRequestContext,
  untilStep: number,
): Promise<Map<number, number>> {
  const start = Date.now()
  const seen = new Map<number, number>()
  await expect
    .poll(
      async () => {
        const step = await liveStep(request)
        if (step !== null && !seen.has(step)) {
          seen.set(step, (Date.now() - start) / 1000)
        }
        return seen.has(untilStep)
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true)
  return seen
}

test.describe('Presentation MIDI music', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
  })

  test('the run plays the MIDI and its verses follow the music', async ({
    request,
  }) => {
    const { id, itemId } = await createMidiPresentation(request)

    expect(
      (await uploadMidi(request, id, itemId, Buffer.from('nope'))).status(),
    ).toBe(400)
    const upload = await uploadMidi(
      request,
      id,
      itemId,
      buildMidiFile(MIDI_SECONDS),
    )
    expect(upload.ok()).toBeTruthy()
    const midi = (await upload.json()).data
    expect(midi).toMatchObject({
      fileName: 'intro.mid',
      durationSeconds: MIDI_SECONDS,
      verseTimes: null,
    })

    // Autoplay is off: the MIDI item still runs by itself, split evenly
    // (2 s a verse), then the run puts the next item up and ends.
    const run = await request.post(`/api/schedules/${id}/run`)
    expect(run.ok()).toBeTruthy()
    expect((await run.json()).data).toMatchObject({
      running: true,
      stepIndex: 0,
    })

    const seen = await watchSteps(request, 3)
    expect(seen.get(1)).toBeGreaterThan(1.2)
    expect(seen.get(1)).toBeLessThan(3)
    expect(seen.get(2)).toBeGreaterThan(3.2)
    expect(seen.get(2)).toBeLessThan(5)
    expect(seen.get(3)).toBeGreaterThan(5.2)
    await expect
      .poll(
        async () =>
          (await (await request.get('/api/schedules/automation')).json()).data
            .running,
      )
      .toBe(false)

    // Synced times: the third verse comes at 1.5 s.
    const bad = await request.put(
      `/api/schedules/${id}/items/${itemId}/midi/verse-times`,
      {
        data: { verseTimes: [0, 3, 1] },
      },
    )
    expect(bad.status()).toBe(400)
    const synced = await request.put(
      `/api/schedules/${id}/items/${itemId}/midi/verse-times`,
      {
        data: { verseTimes: [0, 0.8, 1.5] },
      },
    )
    expect((await synced.json()).data.verseTimes).toEqual([0, 0.8, 1.5])
    await request.post(`/api/schedules/${id}/run`)
    const syncedSeen = await watchSteps(request, 2)
    expect(syncedSeen.get(2)).toBeLessThan(2.8)

    // Removing the file stops its music and the item is a plain song again.
    const removed = await request.delete(
      `/api/schedules/${id}/items/${itemId}/midi`,
    )
    expect(removed.ok()).toBeTruthy()
    const items = (await (await request.get(`/api/schedules/${id}`)).json())
      .data.items
    expect(items[0].midi).toBeNull()
    await request.delete(`/api/schedules/${id}`)
  })

  test('a song item gets a MIDI file and its verses are synced by tapping', async ({
    page,
    request,
  }) => {
    const { id } = await createMidiPresentation(request)
    await page.goto(`/schedules/${id}`)

    const chip = page.getByTestId('schedule-item-midi')
    await expect(chip).toHaveCount(1, { timeout: 15_000 })
    await expect(chip).toHaveText('MIDI')

    await page.getByTestId('schedule-item-midi-file').setInputFiles({
      name: 'intro.mid',
      mimeType: 'audio/midi',
      buffer: buildMidiFile(MIDI_SECONDS),
    })
    await expect(chip).toHaveText('0:06')
    await expect(chip).toHaveAttribute('data-attached', 'true')
    // A MIDI item's slides follow the music: no time per slide beside it.
    await expect(page.getByTestId('schedule-item-advance')).toHaveCount(0)

    await chip.click()
    const popover = page.getByTestId('schedule-item-midi-popover')
    await expect(popover.getByTestId('schedule-item-midi-name')).toContainText(
      'intro.mid',
    )
    await expect(
      popover.getByTestId('schedule-item-midi-sync-state'),
    ).toHaveAttribute('data-synced', 'false')
    await popover.getByTestId('schedule-item-midi-sync').click()

    const modal = page.getByTestId('schedule-midi-sync-modal')
    await expect(modal.getByTestId('schedule-midi-sync-slide')).toHaveCount(3)
    await modal.getByTestId('schedule-midi-sync-start').click()
    const next = modal.getByTestId('schedule-midi-sync-next')
    await expect(next).toBeVisible({ timeout: 60_000 })
    await expect(modal.locator('[data-current="true"]')).toContainText(
      'Prima strofă',
    )
    await page.waitForTimeout(700)
    await next.click()
    await expect(modal.locator('[data-current="true"]')).toContainText(
      'A doua strofă',
    )
    await page.waitForTimeout(700)
    await page.keyboard.press('Space')
    await modal.getByTestId('schedule-midi-sync-save').click()
    await expect(modal).toHaveCount(0)

    const items = (await (await request.get(`/api/schedules/${id}`)).json())
      .data.items
    const times: number[] = items[0].midi.verseTimes
    expect(times).toHaveLength(3)
    expect(times[0]).toBe(0)
    expect(times[1]).toBeGreaterThan(0.5)
    expect(times[2]).toBeGreaterThan(times[1] as number)

    await chip.click()
    await expect(
      popover.getByTestId('schedule-item-midi-sync-state'),
    ).toHaveAttribute('data-synced', 'true')
    await popover.getByTestId('schedule-item-midi-reset').click()
    await expect(
      popover.getByTestId('schedule-item-midi-sync-state'),
    ).toHaveAttribute('data-synced', 'false')
    await popover.getByTestId('schedule-item-midi-remove').click()
    await expect(chip).toHaveText('MIDI')
    await request.delete(`/api/schedules/${id}`)
  })
})
