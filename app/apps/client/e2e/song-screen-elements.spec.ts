import { expect, test } from '@playwright/test'

/**
 * Settings → Screens → Edit now exposes two configurable song elements,
 * mirroring the Bible verse/reference config:
 *  - "songKey" (gama) shown on the first slide,
 *  - "amen" (amin) shown on the last slide,
 * each with position/size/style. They default into every screen's song config
 * (merged on read) and round-trip through the config API.
 */

async function createScreen(
  request: import('@playwright/test').APIRequestContext,
): Promise<number> {
  const res = await request.post('/api/screens', {
    data: { name: `E2E SongElems ${Date.now()}`, type: 'primary' },
  })
  expect([200, 201]).toContain(res.status())
  return (await res.json()).data.id as number
}

test.describe('Song screen elements (songKey + amen)', () => {
  test('a new screen song config includes songKey + amen defaults', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const song = data.contentConfigs.song
      for (const key of ['songKey', 'amen'] as const) {
        expect(song[key], `${key} default present`).toBeTruthy()
        expect(song[key]).toHaveProperty('constraints')
        expect(song[key]).toHaveProperty('size')
        expect(song[key].style).toHaveProperty('color')
        expect(song[key].style).toHaveProperty('fontFamily')
      }
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })

  test('songKey/amen position + style round-trip through the config API', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const song = data.contentConfigs.song

      // Operator repositions/styles + hides the amen element.
      song.songKey.style.color = '#ff0000'
      song.songKey.style.bold = true
      song.amen.hidden = true
      song.amen.style.color = '#00ff00'

      const put = await request.put(`/api/screens/${screenId}/config/song`, {
        data: { config: song },
      })
      expect(put.status()).toBe(200)

      const reread = (
        await (await request.get(`/api/screens/${screenId}`)).json()
      ).data.contentConfigs.song
      expect(reread.songKey.style.color).toBe('#ff0000')
      expect(reread.songKey.style.bold).toBe(true)
      expect(reread.amen.hidden).toBe(true)
      expect(reread.amen.style.color).toBe('#00ff00')
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })
})

/**
 * "Cântec - Primul Slide" (song_first_slide) is a dedicated content type whose config
 * applies only to a song's FIRST slide: two separately positionable elements —
 * the song key (gama) and the slide lyrics (strofa) — like the Bible
 * reference/verse pair. It defaults into every screen and round-trips through
 * the config API independently from the `song` config.
 */
test.describe('Song first slide layout (gama + strofa)', () => {
  test('a new screen includes a song_first_slide config with mainText + songKey defaults', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const cfg = data.contentConfigs.song_first_slide
      expect(cfg, 'song_first_slide config present').toBeTruthy()
      for (const key of ['mainText', 'songKey'] as const) {
        expect(cfg[key], `${key} default present`).toBeTruthy()
        expect(cfg[key]).toHaveProperty('constraints')
        expect(cfg[key]).toHaveProperty('size')
        expect(cfg[key].style).toHaveProperty('color')
        expect(cfg[key].style).toHaveProperty('fontFamily')
      }
      // No amen on the first slide.
      expect(cfg.amen).toBeUndefined()
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })

  test('song_first_slide position + style round-trips independently of song', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const cfg = data.contentConfigs.song_first_slide

      // Operator repositions/styles the gama + strofa for the first slide.
      cfg.songKey.style.color = '#123456'
      cfg.songKey.constraints.top.value = 7
      cfg.mainText.style.color = '#abcdef'

      const put = await request.put(
        `/api/screens/${screenId}/config/song_first_slide`,
        { data: { config: cfg } },
      )
      expect(put.status()).toBe(200)

      const reread = (
        await (await request.get(`/api/screens/${screenId}`)).json()
      ).data.contentConfigs
      expect(reread.song_first_slide.songKey.style.color).toBe('#123456')
      expect(reread.song_first_slide.songKey.constraints.top.value).toBe(7)
      expect(reread.song_first_slide.mainText.style.color).toBe('#abcdef')
      // The plain `song` config is untouched by the first-slide edit.
      expect(reread.song.mainText.style.color).not.toBe('#abcdef')
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })
})

/**
 * "Cântec - Ultimul Slide" (song_last_slide) is a dedicated content type whose config
 * applies only to a song's LAST slide: two separately positionable elements —
 * the slide lyrics (strofa) and the "Amin" — like the Bible reference/verse
 * pair. It defaults into every screen and round-trips through the config API
 * independently from the `song` config.
 */
test.describe('Song last slide layout (strofa + amin)', () => {
  test('a new screen includes a song_last_slide config with mainText + amen defaults', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const cfg = data.contentConfigs.song_last_slide
      expect(cfg, 'song_last_slide config present').toBeTruthy()
      for (const key of ['mainText', 'amen'] as const) {
        expect(cfg[key], `${key} default present`).toBeTruthy()
        expect(cfg[key]).toHaveProperty('constraints')
        expect(cfg[key]).toHaveProperty('size')
        expect(cfg[key].style).toHaveProperty('color')
        expect(cfg[key].style).toHaveProperty('fontFamily')
      }
      // No songKey (gama) on the last slide.
      expect(cfg.songKey).toBeUndefined()
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })

  test('song_last_slide position + style round-trips independently of song', async ({
    request,
  }) => {
    const screenId = await createScreen(request)
    try {
      const { data } = await (
        await request.get(`/api/screens/${screenId}`)
      ).json()
      const cfg = data.contentConfigs.song_last_slide

      // Operator repositions/styles + hides the amen for the last slide.
      cfg.amen.style.color = '#654321'
      cfg.amen.constraints.top.value = 90
      cfg.mainText.style.color = '#fedcba'

      const put = await request.put(
        `/api/screens/${screenId}/config/song_last_slide`,
        { data: { config: cfg } },
      )
      expect(put.status()).toBe(200)

      const reread = (
        await (await request.get(`/api/screens/${screenId}`)).json()
      ).data.contentConfigs
      expect(reread.song_last_slide.amen.style.color).toBe('#654321')
      expect(reread.song_last_slide.amen.constraints.top.value).toBe(90)
      expect(reread.song_last_slide.mainText.style.color).toBe('#fedcba')
      // The plain `song` config is untouched by the last-slide edit.
      expect(reread.song.mainText.style.color).not.toBe('#fedcba')
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })
})
