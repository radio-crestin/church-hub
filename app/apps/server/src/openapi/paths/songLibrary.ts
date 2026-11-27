/** An error answer of the song library routes: the message and its code. */
const error = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { error: { type: 'string' }, code: { type: 'string' } },
      },
    },
  },
})

const json = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data } },
    },
  },
})

const curatorErrors = {
  '401': error('Sign in with Google first (owner_sign_in_required)'),
  '403': error(
    'Not from localhost, no users.edit, or not a curator (not_curator)',
  ),
  '502': error('The sync service failed'),
}

const submission = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    submittedAt: { type: 'integer', description: 'Unix ms' },
    title: { type: 'string' },
    churchName: { type: ['string', 'null'] },
    note: { type: ['string', 'null'] },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: ['string', 'null'] },
          text: { type: 'string' },
        },
      },
    },
    matches: {
      type: 'array',
      description: 'Library songs with the same lyrics, then the same title',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          sameLyrics: { type: 'boolean' },
        },
      },
    },
  },
}

const featuredSource = {
  type: 'object',
  properties: {
    sourceId: { type: 'string' },
    name: { type: 'string' },
    categoryName: { type: 'string' },
    description: { type: ['string', 'null'] },
    homepage: { type: ['string', 'null'] },
    license: { type: ['string', 'null'] },
  },
  required: ['sourceId', 'name', 'categoryName'],
}

/**
 * The curated Church Hub Library (T-177): songs sent to it, and its
 * curators’ queue. The curator routes are localhost only (users.edit); the
 * account signs in through the owner sign-in with intent `curate`.
 */
export const songLibraryPaths: Record<string, Record<string, unknown>> = {
  '/api/song-library-submissions': {
    post: {
      tags: ['Songs'],
      summary: 'Submit songs to the Church Hub Library',
      description:
        'Sends the chosen songs and every song of the chosen categories (500 at most), each as its OpenSong file, to the Church Hub Library’s curators through the sync service, in one request. Each song is reviewed on its own. Rate-limited by the service.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                songIds: { type: 'array', items: { type: 'integer' } },
                categoryIds: { type: 'array', items: { type: 'integer' } },
                note: { type: 'string', maxLength: 1000 },
              },
            },
          },
        },
      },
      responses: {
        '200': json('Submitted', {
          type: 'object',
          properties: {
            batchId: { type: 'string' },
            submitted: { type: 'integer' },
          },
        }),
        '400': error('Neither songIds nor categoryIds'),
        '403': error('No songs.edit'),
        '404': error('None of the songs exist (song_not_found)'),
        '413': error('More than 500 songs (too_many_songs)'),
        '429': error('Too many submissions (rate_limited)'),
        '502': error('The sync service failed'),
      },
    },
  },
  '/api/song-library/curator': {
    get: {
      tags: ['Songs'],
      summary: 'Who curates the Church Hub Library on this PC',
      responses: {
        '200': json('The signed-in account, if any', {
          type: 'object',
          properties: {
            signedIn: { type: 'boolean' },
            email: { type: ['string', 'null'] },
            curator: { type: 'boolean' },
          },
        }),
        ...curatorErrors,
      },
    },
  },
  '/api/song-library/submissions': {
    get: {
      tags: ['Songs'],
      summary: 'The submissions waiting for a curator',
      responses: {
        '200': json('Oldest first', { type: 'array', items: submission }),
        ...curatorErrors,
      },
    },
  },
  '/api/song-library/songs': {
    get: {
      tags: ['Songs'],
      summary: 'Search the library’s songs by title (to merge into)',
      parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      responses: {
        '200': json('Up to 20', {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
        }),
        ...curatorErrors,
      },
    },
  },
  '/api/song-library/featured': {
    get: {
      tags: ['Songs'],
      summary: 'The song sources every app is offered',
      description:
        'Church Hub’s featured list as this app last read it (from the cloud at start, else the installer’s copy); empty before one is published.',
      responses: {
        '200': json('In order', { type: 'array', items: featuredSource }),
        ...curatorErrors,
      },
    },
    put: {
      tags: ['Songs'],
      summary: 'Publish the song sources every app is offered (a curator)',
      description:
        'Libraries Church Hub manages (published with scripts/publish-library.ts or the curated one), each with a name and the category its songs land in. Every app reads the list at start; installers ship it with its libraries.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { sources: { type: 'array', items: featuredSource } },
              required: ['sources'],
            },
          },
        },
      },
      responses: {
        '200': json('Published; the list as saved', {
          type: 'array',
          items: featuredSource,
        }),
        '400': error('A source is a church’s library or not published yet'),
        ...curatorErrors,
      },
    },
  },
  '/api/song-library/submissions/{id}/decision': {
    post: {
      tags: ['Songs'],
      summary: 'Approve, merge or reject a submission',
      description:
        'approved: published as a new library song. merged: published as the new version of librarySongId. Either rebuilds only that song’s shard on this PC, uploads it and the manifest (built again if another curator published first). rejected: nothing is published.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                decision: { enum: ['approved', 'merged', 'rejected'] },
                librarySongId: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['decision'],
            },
          },
        },
      },
      responses: {
        '200': json('Decided', {
          type: 'object',
          properties: { librarySongId: { type: ['string', 'null'] } },
        }),
        '400': error('Invalid decision'),
        '404': error('No such submission or library song'),
        ...curatorErrors,
      },
    },
  },
}
