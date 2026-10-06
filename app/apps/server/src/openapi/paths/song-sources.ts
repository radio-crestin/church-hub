/**
 * Song sources — the places Song discovery imports songs from (built-in
 * config files and links others shared), and the user's own categories
 * published to their S3 bucket as song bundles.
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Song Sources']

const dataOf = (schema: object) => ({
  'application/json': {
    schema: { type: 'object', properties: { data: schema } },
  },
})
const arrayOf = (ref: string) => ({
  type: 'array',
  items: { $ref: `#/components/schemas/${ref}` },
})
const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
}

/** GET /api/song-sources/updates: each source's last check. */
const songUpdates = {
  type: 'object',
  properties: {
    running: { type: 'boolean' },
    autoUpdate: { type: 'boolean' },
    finishedAt: { type: 'integer', nullable: true },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
          name: { type: 'string' },
          checksum: { type: 'string' },
          newCount: { type: 'integer' },
          imported: { type: 'integer' },
          checkedAt: { type: 'integer' },
          error: { type: 'string' },
        },
      },
    },
  },
}
const idParameter = (type: 'string' | 'integer') => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type },
})

export const songSourcesPaths = {
  '/api/song-sources': {
    get: {
      tags,
      summary: 'List song sources',
      description:
        'Built-in sources first, then sources added from links. Requires `songs.view`.',
      security,
      responses: {
        '200': {
          description: 'Song sources',
          content: dataOf(arrayOf('SongSource')),
        },
        ...errors,
      },
    },
    post: {
      tags,
      summary: 'Add a source from a shared link',
      description:
        'The link is a `.chsongs` file or a song bundle folder’s manifest.json. It is read first, so a wrong link fails here; the name and category come from its manifest. https only (http on localhost). Requires `songs.create`.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: { url: { type: 'string', format: 'uri' } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The added source',
          content: dataOf({ $ref: '#/components/schemas/SongSource' }),
        },
        '400': { description: 'Not a valid link, or not a song source' },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}': {
    delete: {
      tags,
      summary: 'Remove a source added from a link',
      description: 'Built-in sources stay. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The remaining sources',
          content: dataOf(arrayOf('SongSource')),
        },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/songs': {
    get: {
      tags,
      summary: 'Read a shared folder’s songs',
      description:
        'For `song-bundle-folder` sources: only the songs whose hash changed since the last read are downloaded. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The source’s OpenSong files, in manifest order',
          content: dataOf(arrayOf('SongBundleFile')),
        },
        '502': { description: 'The source could not be read' },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/archive': {
    get: {
      tags,
      summary: 'Download a song file source’s archive',
      description:
        'For `song-bundle-file` sources: the `.chsongs` file, downloaded by the server (links are checked to reach public addresses only). Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The archive',
          content: {
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '502': { description: 'The source could not be read' },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/checksum': {
    get: {
      tags,
      summary: 'Get what changes when a source’s songs change',
      description:
        'Cheap: the `.sha256` published next to an archive, a shared folder’s manifest checksum, or cantaricrestine.ro’s song count. Empty when the source offers none. Requires `songs.view`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The checksum',
          content: dataOf({
            type: 'object',
            properties: { checksum: { type: 'string' } },
          }),
        },
        '502': { description: 'The source could not be read' },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/lacking': {
    get: {
      tags,
      summary: 'Get the songs a source has that the library lacks',
      description:
        'From the last check (done in a worker thread), so it answers at once: each song with its parsed slides and metadata, its verdict (`new`, or `similar` when the library has a version under another title) and the similar library songs. Songs added to the library since are left out. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The songs',
          content: dataOf({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                sourceFilename: { type: 'string', nullable: true },
                parsed: { type: 'object' },
                verdict: { type: 'string', enum: ['new', 'similar'] },
                similar: { type: 'array', items: { type: 'object' } },
              },
            },
          }),
        },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/new-count': {
    put: {
      tags,
      summary: 'Record Song discovery’s count of a source’s new songs',
      description:
        'Song discovery’s own count once it compared the source with the library, fresher than the last check after an import. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newCount'],
              properties: { newCount: { type: 'integer', minimum: 0 } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
        '400': { description: 'newCount is not a whole number' },
        '404': { description: 'No such source' },
        ...errors,
      },
    },
  },
  '/api/song-sources/updates': {
    get: {
      tags,
      summary: 'Get each source’s last check for new songs',
      description:
        'The sources are checked in a worker thread a bit after the server starts, then daily: a source whose checksum did not change is not downloaded again. When updating songs automatically (the default), songs with no similar version in the library are added to the source’s category. Requires `songs.view`.',
      security,
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
        ...errors,
      },
    },
  },
  '/api/song-sources/updates/run': {
    post: {
      tags,
      summary: 'Check the song sources now',
      description:
        'Starts a run in the worker thread and answers at once; `running` turns false when it is done. `force` downloads every source even when its checksum did not change; `sourceIds` limits the run to those sources. Requires `songs.create`.',
      security,
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                force: { type: 'boolean' },
                sourceIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        '202': { description: 'The run started', content: dataOf(songUpdates) },
        ...errors,
      },
    },
  },
  '/api/song-sources/updates/settings': {
    put: {
      tags,
      summary: 'Turn updating songs automatically on or off',
      description: 'On by default. Requires `settings.edit`.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['autoUpdate'],
              properties: { autoUpdate: { type: 'boolean' } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
        '400': { description: 'autoUpdate is not a boolean' },
        ...errors,
      },
    },
  },
  '/api/song-sources/export': {
    get: {
      tags,
      summary: 'Export a category as a song bundle (.chsongs or .zip)',
      description:
        'A ZIP of manifest.json plus one OpenSong file per song, named after the song. `format=chsongs` (default) names it `.chsongs`, which Church Hub opens; `format=zip` gives the same bytes as a `.zip` for other programs. Requires `songs.view`.',
      security,
      parameters: [
        {
          name: 'categoryId',
          in: 'query',
          required: true,
          schema: { type: 'integer' },
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['chsongs', 'zip'] },
        },
      ],
      responses: {
        '200': {
          description: 'The song bundle file',
          content: {
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '404': { description: 'Category not found' },
        ...errors,
      },
    },
  },
  '/api/song-sources/storage': {
    get: {
      tags,
      summary: 'Get the S3 storage',
      description:
        'Null until one is saved. The secret key is never returned. Requires `settings.view`.',
      security,
      responses: {
        '200': {
          description: 'The storage',
          content: dataOf({
            $ref: '#/components/schemas/S3Storage',
            nullable: true,
          }),
        },
        ...errors,
      },
    },
    put: {
      tags,
      summary: 'Save the S3 storage',
      description:
        'An empty secret keeps the stored one. Requires `settings.edit`.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/S3StorageInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'The saved storage',
          content: dataOf({ $ref: '#/components/schemas/S3Storage' }),
        },
        '400': { description: 'A field is missing or not a URL' },
        ...errors,
      },
    },
  },
  '/api/song-sources/publications': {
    get: {
      tags,
      summary: 'List published categories',
      description: 'Requires `settings.view`.',
      security,
      responses: {
        '200': {
          description: 'Published categories',
          content: dataOf(arrayOf('SongSourcePublication')),
        },
        ...errors,
      },
    },
    post: {
      tags,
      summary: 'Publish a category to the S3 storage',
      description:
        'Uploads one object per song plus manifest.json, and keeps them in sync (every 5 minutes, only what changed). Requires `settings.edit`.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['categoryId'],
              properties: { categoryId: { type: 'integer' } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Published categories',
          content: dataOf(arrayOf('SongSourcePublication')),
        },
        '400': { description: 'No storage configured' },
        '502': { description: 'The upload failed' },
        ...errors,
      },
    },
  },
  '/api/song-sources/publications/{id}/sync': {
    post: {
      tags,
      summary: 'Upload a published category’s changes now',
      description: 'Requires `settings.edit`.',
      security,
      parameters: [idParameter('integer')],
      responses: {
        '200': {
          description: 'Published categories',
          content: dataOf(arrayOf('SongSourcePublication')),
        },
        '404': { description: 'Publication not found' },
        '502': { description: 'The upload failed' },
        ...errors,
      },
    },
  },
  '/api/song-sources/publications/{id}': {
    delete: {
      tags,
      summary: 'Stop publishing a category',
      description:
        'Deletes the files this app uploaded (manifest first, so the link stops working). Requires `settings.edit`.',
      security,
      parameters: [idParameter('integer')],
      responses: {
        '200': {
          description: 'Published categories',
          content: dataOf(arrayOf('SongSourcePublication')),
        },
        '502': { description: 'Deleting the files failed' },
        ...errors,
      },
    },
  },
}
