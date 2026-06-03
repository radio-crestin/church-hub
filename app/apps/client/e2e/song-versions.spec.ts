import { expect, test } from '@playwright/test'

/**
 * Verifies the Song Versions feature end-to-end via the public API:
 *   - linking two songs creates a group and marks them as members,
 *   - GET /api/songs/:id/group returns the same group from either member,
 *   - setting a different primary updates the group's primarySongId,
 *   - unlinking a member detaches that song; collapsing a single-member
 *     group restores both members to standalone (so the data model can't
 *     get stuck with "groups of one").
 *
 * The default `request` fixture carries the super-admin session (see
 * auth.setup.ts), which grants all `songs.*` permissions.
 */

const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

test.describe('Song Versions', () => {
  const createdSongIds: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of createdSongIds) {
      await request.delete(`/api/songs/${id}`).catch(() => undefined)
    }
  })

  async function createSong(
    request: import('@playwright/test').APIRequestContext,
    title: string,
  ): Promise<number> {
    const res = await request.post('/api/songs', {
      data: {
        title,
        slides: [{ content: `${title} stanza 1` }],
      },
    })
    expect([200, 201]).toContain(res.status())
    const id = (await res.json()).data.id as number
    createdSongIds.push(id)
    return id
  }

  test('linking creates a group containing both songs as members', async ({
    request,
  }) => {
    const a = await createSong(request, `E2E Versions A ${tag}`)
    const b = await createSong(request, `E2E Versions B ${tag}`)

    const link = await request.post('/api/song-groups/link', {
      data: { songIdA: a, songIdB: b },
    })
    expect(link.ok()).toBeTruthy()
    const group = (await link.json()).data
    expect(group.members).toHaveLength(2)
    expect(group.memberSongIds).toEqual(expect.arrayContaining([a, b]))
    // The first arg becomes the initial primary.
    expect(group.primarySongId).toBe(a)
  })

  test('GET /api/songs/:id/group returns the same group from either member', async ({
    request,
  }) => {
    const a = await createSong(request, `E2E Versions C ${tag}`)
    const b = await createSong(request, `E2E Versions D ${tag}`)

    const linked = (
      await (
        await request.post('/api/song-groups/link', {
          data: { songIdA: a, songIdB: b },
        })
      ).json()
    ).data

    const fromA = (await (await request.get(`/api/songs/${a}/group`)).json())
      .data
    const fromB = (await (await request.get(`/api/songs/${b}/group`)).json())
      .data

    expect(fromA?.id).toBe(linked.id)
    expect(fromB?.id).toBe(linked.id)
    expect(fromA?.members).toHaveLength(2)
  })

  test('setting a different primary updates primarySongId', async ({
    request,
  }) => {
    const a = await createSong(request, `E2E Versions E ${tag}`)
    const b = await createSong(request, `E2E Versions F ${tag}`)

    const group = (
      await (
        await request.post('/api/song-groups/link', {
          data: { songIdA: a, songIdB: b },
        })
      ).json()
    ).data

    expect(group.primarySongId).toBe(a)

    const updated = await request.post(`/api/song-groups/${group.id}/primary`, {
      data: { songId: b },
    })
    expect(updated.ok()).toBeTruthy()
    const updatedGroup = (await updated.json()).data
    expect(updatedGroup.primarySongId).toBe(b)
  })

  test('unlinking a member detaches it and collapses a 1-member group', async ({
    request,
  }) => {
    const a = await createSong(request, `E2E Versions G ${tag}`)
    const b = await createSong(request, `E2E Versions H ${tag}`)

    await request.post('/api/song-groups/link', {
      data: { songIdA: a, songIdB: b },
    })

    // Detach B → only A remains in the group → group is collapsed → A is
    // also detached and the group no longer exists.
    const detach = await request.delete(`/api/songs/${b}/group`)
    expect(detach.ok()).toBeTruthy()

    expect(
      (await (await request.get(`/api/songs/${a}/group`)).json()).data,
    ).toBeNull()
    expect(
      (await (await request.get(`/api/songs/${b}/group`)).json()).data,
    ).toBeNull()
  })

  test('the song detail page shows the "Same song as…" call to action when standalone', async ({
    page,
    request,
  }) => {
    const a = await createSong(request, `E2E Versions UI A ${tag}`)

    await page.goto(`/songs/${a}`)
    await page.waitForLoadState('networkidle')

    // Standalone song with edit permission → the panel exposes the link
    // button. Match by visible text (i18n could be EN or RO).
    await expect(
      page.getByRole('button', { name: /same song as|aceea[șs]i c[âa]ntare/i }),
    ).toBeVisible({ timeout: 10000 })
  })
})
