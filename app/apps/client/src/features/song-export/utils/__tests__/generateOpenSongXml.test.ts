import { describe, expect, it, vi } from 'vitest'

// Mock the expandSongSlides dependency
vi.mock('~/features/songs/utils/expandSongSlides', () => ({
  generateExpandedPresentationOrder: vi.fn(() => null),
}))

import type { SongWithSlides } from '~/features/songs/types'
import { generateOpenSongXml } from '../generateOpenSongXml'

function makeSong(overrides: Partial<SongWithSlides> = {}): SongWithSlides {
  return {
    id: 1,
    title: 'Test Song',
    author: null,
    copyright: null,
    ccli: null,
    key: null,
    tempo: null,
    timeSignature: null,
    theme: null,
    altTheme: null,
    hymnNumber: null,
    keyLine: null,
    presentationOrder: null,
    slides: [],
    categoryId: null,
    categoryName: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as SongWithSlides
}

describe('song-export/utils/generateOpenSongXml', () => {
  it('generates valid XML structure', () => {
    const xml = generateOpenSongXml(makeSong())
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<song>')
    expect(xml).toContain('</song>')
  })

  it('includes title element', () => {
    const xml = generateOpenSongXml(makeSong({ title: 'Amazing Grace' }))
    expect(xml).toContain('<title>Amazing Grace</title>')
  })

  it('includes church_hub_id', () => {
    const xml = generateOpenSongXml(makeSong({ id: 42 }))
    expect(xml).toContain('<church_hub_id>42</church_hub_id>')
  })

  it('includes author when present', () => {
    const xml = generateOpenSongXml(makeSong({ author: 'John Newton' }))
    expect(xml).toContain('<author>John Newton</author>')
  })

  it('omits empty metadata fields', () => {
    const xml = generateOpenSongXml(makeSong({ author: null, copyright: null }))
    expect(xml).not.toContain('<author>')
    expect(xml).not.toContain('<copyright>')
  })

  it('escapes XML special characters in title', () => {
    const xml = generateOpenSongXml(makeSong({ title: 'Song & "Grace"' }))
    expect(xml).toContain('Song &amp; &quot;Grace&quot;')
  })

  it('generates lyrics section from slides', () => {
    const xml = generateOpenSongXml(
      makeSong({
        slides: [
          {
            id: 1,
            songId: 1,
            content: '<p>Line one</p><p>Line two</p>',
            sortOrder: 0,
            label: 'V1',
            isChorus: false,
            chordsData: null,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    )
    expect(xml).toContain('<lyrics>')
    expect(xml).toContain('[V1]')
    expect(xml).toContain(' Line one')
    expect(xml).toContain(' Line two')
  })

  it('appends "Amin!" to the last slide if not present', () => {
    const xml = generateOpenSongXml(
      makeSong({
        slides: [
          {
            id: 1,
            songId: 1,
            content: '<p>Last verse</p>',
            sortOrder: 0,
            label: 'V1',
            isChorus: false,
            chordsData: null,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    )
    expect(xml).toContain(' Amin!')
  })

  it('does not duplicate Amin if already present', () => {
    const xml = generateOpenSongXml(
      makeSong({
        slides: [
          {
            id: 1,
            songId: 1,
            content: '<p>Last verse</p><p>Amin!</p>',
            sortOrder: 0,
            label: 'V1',
            isChorus: false,
            chordsData: null,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    )
    // Count occurrences of "Amin"
    const matches = xml.match(/Amin/g)
    expect(matches).toHaveLength(1)
  })

  it('handles slides without labels', () => {
    const xml = generateOpenSongXml(
      makeSong({
        slides: [
          {
            id: 1,
            songId: 1,
            content: '<p>Unlabeled line</p>',
            sortOrder: 0,
            label: null,
            isChorus: false,
            chordsData: null,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    )
    expect(xml).toContain(' Unlabeled line')
    // Should not contain bracket labels like [null]
    expect(xml).not.toContain('[null]')
  })

  it('decodes HTML entities in lyrics', () => {
    const xml = generateOpenSongXml(
      makeSong({
        slides: [
          {
            id: 1,
            songId: 1,
            content: '<p>Rock &amp; Roll</p>',
            sortOrder: 0,
            label: 'V1',
            isChorus: false,
            chordsData: null,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    )
    expect(xml).toContain(' Rock & Roll')
  })
})
