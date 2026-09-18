import { describe, expect, it } from 'vitest'

import { getBackgroundMediaAccept } from '../getBackgroundMediaAccept'

describe('getBackgroundMediaAccept', () => {
  it('lists only the types of one kind', () => {
    const accept = getBackgroundMediaAccept('video').split(',')
    expect(accept).toEqual(['video/mp4', 'video/webm', '.mp4', '.webm'])
  })

  it('lists images and videos alike when no kind is given', () => {
    const accept = getBackgroundMediaAccept().split(',')
    expect(accept).toEqual(
      expect.arrayContaining([
        'image/jpeg',
        'image/png',
        'video/mp4',
        'video/webm',
        '.jpg',
        '.jpeg',
        '.mp4',
        '.webm',
      ]),
    )
  })
})
