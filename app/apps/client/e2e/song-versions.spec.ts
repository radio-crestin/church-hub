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

  test('the song detail page shows the "Add a version" call to action when standalone', async ({
    page,
    request,
  }) => {
    const a = await createSong(request, `E2E Versions UI A ${tag}`)

    await page.goto(`/songs/${a}`)
    await page.waitForLoadState('networkidle')

    // Standalone song with edit permission → the versions panel header exposes
    // the "Add a version" CTA that opens the link modal. Match by visible text
    // (i18n could be EN or RO).
    await expect(
      page.getByRole('button', { name: /add a version|adaug[ăa] o versiune/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('GET /api/songs/:id/similar returns a similarly-titled candidate', async ({
    request,
  }) => {
    // Two near-identical titles, only diacritics + punctuation differ. The
    // ASCII-fold + content-word Jaccard pass should match them perfectly,
    // mirroring the real dirtiness in the user's 30k corpus.
    const original = await createSong(
      request,
      `Doamne Te slavesc fara diacritice ${tag}`,
    )
    const alt = await createSong(
      request,
      `Doamne, Te slăvesc fără diacritice ${tag}`,
    )

    const res = await request.get(`/api/songs/${original}/similar?limit=5`)
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    expect(Array.isArray(data)).toBe(true)
    const ids = data.map((s: { songId: number }) => s.songId)
    expect(ids).toContain(alt)
  })

  test('filler-word titles do NOT pull in semantically unrelated songs', async ({
    request,
  }) => {
    // Reproduces the false-positive cluster the operator hit on
    // "Doamne mai vreau Rusalii cu limbi de foc":
    //  - the duplicate (true positive)  must be surfaced,
    //  - the filler-word matches (FPs)  must be dropped.
    const subject = await createSong(
      request,
      `Doamne mai vreau Rusalii cu limbi de foc ${tag}`,
    )
    const truePositive = await createSong(
      request,
      `Doamne mai vreau Rusalii cu limbi de foc ${tag} v2`,
    )
    const fp1 = await createSong(request, `Doamne nu mai vreau nimic ${tag}`)
    const fp2 = await createSong(
      request,
      `Doamne vreau si-Ti cer sa fiu ${tag}`,
    )
    const fp3 = await createSong(
      request,
      `Vreau sa ies Doamne astazi din lume ${tag}`,
    )
    const fp4 = await createSong(
      request,
      `Chiar mii de limbi de as vrea ${tag}`,
    )

    const res = await request.get(`/api/songs/${subject}/similar?limit=10`)
    const { data } = await res.json()
    const ids: number[] = data.map((s: { songId: number }) => s.songId)

    expect(ids).toContain(truePositive)
    // None of the filler-word collisions may surface.
    expect(ids).not.toContain(fp1)
    expect(ids).not.toContain(fp2)
    expect(ids).not.toContain(fp3)
    expect(ids).not.toContain(fp4)
  })

  test('a rewritten title with near-identical lyrics is still surfaced', async ({
    request,
  }) => {
    // The scoring rule "no title overlap OK if lyrics overlap >= 0.7" is
    // load-bearing for translated / paraphrased titles. Build two songs
    // with disjoint titles but identical lyrics, then assert the surface.
    const lyrics = [
      { content: 'Slavă Ție-mi cânt cu dor și mulțumire' },
      { content: 'Cer cu drag iertarea Ta și pace' },
    ]
    const a = await request
      .post('/api/songs', {
        data: { title: `Cantarea izvor de pace ${tag}`, slides: lyrics },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(a)
    const b = await request
      .post('/api/songs', {
        data: { title: `Refren al iertarii ${tag}`, slides: lyrics },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(b)

    const res = await request.get(`/api/songs/${a}/similar?limit=5`)
    const { data } = await res.json()
    const ids: number[] = data.map((s: { songId: number }) => s.songId)
    expect(ids).toContain(b)
  })

  test('similar suggestions exclude existing group members', async ({
    request,
  }) => {
    // Create three similar titles. Group two of them, then ask for
    // suggestions on the first — it must NOT propose its already-linked
    // sibling (that would be noise the operator already resolved).
    const a = await createSong(request, `Iisus Hristos a inviat ${tag}`)
    const b = await createSong(request, `Iisus Hristos a înviat ${tag}`)
    const c = await createSong(request, `Iisus Hristos a inviat azi ${tag}`)

    await request.post('/api/song-groups/link', {
      data: { songIdA: a, songIdB: b },
    })

    const res = await request.get(`/api/songs/${a}/similar?limit=10`)
    const { data } = await res.json()
    const ids = data.map((s: { songId: number }) => s.songId)
    expect(ids).not.toContain(b) // already a group sibling — filtered out
    expect(ids).not.toContain(a) // never suggest the song itself
    expect(ids).toContain(c) // a different similar song — surfaced
  })

  test('the opened song leads the grouped versions list, highlighted with a badge', async ({
    page,
    request,
  }) => {
    // "ZZZ…" sorts after "AAA…", so plain title order would put the sibling
    // first — the panel must still pin the opened song to the top.
    const a = await createSong(request, `ZZZ E2E Pinned Top ${tag}`)
    const b = await createSong(request, `AAA E2E Pinned Top ${tag}`)
    await request.post('/api/song-groups/link', {
      data: { songIdA: a, songIdB: b },
    })

    await page.goto(`/songs/${a}`)
    const current = page.getByTestId('version-current-row')
    await expect(current).toBeVisible({ timeout: 10000 })
    await expect(current).toContainText(`ZZZ E2E Pinned Top ${tag}`)
    // The "you are here" badge (EN or RO build).
    await expect(current).toContainText(/current|curent/i)
    // …and it renders above every other member row.
    const rows = page.locator(
      '[data-testid="version-current-row"], [data-testid="version-member-row"]',
    )
    await expect(rows.first()).toHaveAttribute(
      'data-testid',
      'version-current-row',
    )
    await expect(
      page.getByTestId('version-member-row').first(),
    ).toContainText(`AAA E2E Pinned Top ${tag}`)
  })

  test('a standalone song shows its own highlighted row first, then suggestions sorted by score', async ({
    page,
    request,
  }) => {
    const sharedVerse = `Strofa unica de test pentru sortare ${tag}`
    const subject = await request
      .post('/api/songs', {
        data: {
          title: `Sortare scor mare ${tag}`,
          slides: [{ content: sharedVerse }],
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(subject)
    // Near-duplicate: same title + identical verse → top score.
    const high = await request
      .post('/api/songs', {
        data: {
          title: `Sortare scor mare ${tag} v2`,
          slides: [{ content: sharedVerse }],
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(high)
    // Same title but only half the verses overlap → clearly lower score.
    const low = await request
      .post('/api/songs', {
        data: {
          title: `Sortare scor mare ${tag} extra`,
          slides: [
            { content: `Strofa unica de test ${tag}` },
            { content: 'Complet alte cuvinte adaugate aici acum' },
          ],
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(low)

    await page.goto(`/songs/${subject}`)

    // The opened song leads, highlighted with the badge.
    const current = page.getByTestId('version-current-row')
    await expect(current).toBeVisible({ timeout: 10000 })
    await expect(current).toContainText(`Sortare scor mare ${tag}`)
    await expect(current).toContainText(/current|curent/i)

    // Both crafted candidates are suggested, best match first.
    const suggestionRows = page.getByTestId('version-suggestion-row')
    await expect(suggestionRows).toHaveCount(2, { timeout: 10000 })
    await expect(suggestionRows.nth(0)).toContainText(
      `Sortare scor mare ${tag} v2`,
    )
    await expect(suggestionRows.nth(1)).toContainText(
      `Sortare scor mare ${tag} extra`,
    )

    // The visible percentages must read top-down from most to least similar.
    const texts = await suggestionRows.allInnerTexts()
    const percents = texts.map((t) => Number(/(\d+)\s*%/.exec(t)?.[1] ?? -1))
    expect(percents.every((p) => p >= 0)).toBe(true)
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeLessThanOrEqual(percents[i - 1])
    }
  })

  test('a standalone song with no matches shows the subtle empty state', async ({
    page,
    request,
  }) => {
    const lonely = await request
      .post('/api/songs', {
        data: {
          title: `Xyzzqw plugh frobnitz ${tag}`,
          slides: [{ content: `Qwertzuiop asdfghjkl yxcvbnm ${tag}` }],
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(lonely)

    await page.goto(`/songs/${lonely}`)

    // Current song still leads the panel…
    const current = page.getByTestId('version-current-row')
    await expect(current).toBeVisible({ timeout: 10000 })
    await expect(current).toContainText(`Xyzzqw plugh frobnitz ${tag}`)
    // …followed by the subtle "no other versions" line instead of a void.
    await expect(page.getByTestId('versions-empty-state')).toBeVisible({
      timeout: 10000,
    })
  })

  test('a re-titled version (different title, ≥70% identical verses) is surfaced via lyrics recall', async ({
    request,
  }) => {
    // Stronger than the earlier "rewritten title" case: here the two titles
    // share NO word with each other OR with the verses, so a title-only FTS
    // pass can never reach the candidate. The match can ONLY come from the
    // verse-overlap recall — this is the regression guard for matching by
    // verses. The verses are identical (Jaccard 1.0, well over the 70% bar).
    //
    // NB: the run `tag` is deliberately kept OUT of the verses — putting it in
    // the lyrics AND the subject title would let the title-FTS query match the
    // candidate's content on the shared tag token, masking the lyrics pass.
    const verses = [
      { content: 'Izvorul tainic susura pe coama muntelui de clestar' },
      { content: 'Privighetoarea ingana un cantec uitat peste valea adanca' },
    ]
    const subject = await request
      .post('/api/songs', {
        data: {
          title: `Dimineata aurie de toamna tarzie ${tag}`,
          slides: verses,
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(subject)
    const reTitled = await request
      .post('/api/songs', {
        data: {
          title: 'Cantarea linistii necuprinse de seara',
          slides: verses,
        },
      })
      .then((r) => r.json())
      .then((j) => j.data.id as number)
    createdSongIds.push(reTitled)

    const res = await request.get(`/api/songs/${subject}/similar?limit=10`)
    const { data } = await res.json()
    const hit = data.find((s: { songId: number }) => s.songId === reTitled)
    expect(hit).toBeTruthy()
    // It matched on the verses, not the title.
    expect(hit.reason).toBe('lyrics')
    expect(hit.score).toBeGreaterThanOrEqual(0.7)
  })
})
