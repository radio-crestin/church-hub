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
