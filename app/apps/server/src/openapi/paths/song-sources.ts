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
          newCount: {
            type: 'integer',
            description: 'New songs waiting for approval',
          },
          similarCount: {
            type: 'integer',
            description:
              'Songs the library has under another title, for review in Song discovery',
          },
          changedCount: {
            type: 'integer',
            description:
              'Library songs the source changed, waiting for approval',
          },
          imported: { type: 'integer' },
          updated: { type: 'integer' },
          checkedAt: { type: 'integer' },
          error: {
            type: 'string',
            description:
              'Why the source could not be checked, when it could not',
          },
          httpStatus: {
            type: 'string',
            description:
              'The HTTP status its download got, when that was why, e.g. "403 Forbidden"',
          },
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

const share = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    sourceId: {
      type: 'string',
      description: '<churchId>-<random>: the library folder',
    },
    name: { type: 'string' },
    publisher: { type: 'string' },
    categoryIds: {
      type: 'array',
      nullable: true,
      items: { type: 'integer' },
      description: 'null: the whole library',
    },
    songIds: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Songs picked one by one, besides the categories',
    },
    songs: {
      type: 'array',
      description: 'The picked songs still in the library, with their titles',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, title: { type: 'string' } },
      },
    },
    listed: { type: 'boolean' },
    manifestUrl: {
      type: 'string',
      nullable: true,
      description: 'The link others add as a song source',
    },
    publishedChecksum: { type: 'string', nullable: true },
    publishedShards: { type: 'array', items: { type: 'string' } },
    songCount: { type: 'integer' },
    lastSyncedAt: { type: 'integer', nullable: true },
    lastError: { type: 'string', nullable: true },
  },
}

/** POST /shares and PUT /shares/{id}: what the share holds. */
const shareBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['name', 'categoryIds', 'listed'],
        properties: {
          name: { type: 'string' },
          publisher: { type: 'string' },
          categoryIds: {
            type: 'array',
            nullable: true,
            items: { type: 'integer' },
            description: 'null: the whole library',
          },
          songIds: { type: 'array', items: { type: 'integer' } },
          listed: { type: 'boolean' },
        },
      },
    },
  },
}

export const songSourcesPaths = {
  '/api/song-sources/shares': {
    get: {
      tags,
      summary: '"Share my songs": the shares',
      description:
        'The church’s shares, each a group of songs with its own link (empty while it shares nothing), and whether cloud sync is on, which sharing needs. Requires `settings.view`.',
      security,
      responses: {
        '200': {
          description: 'The shares',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: share },
                  cloudSync: { type: 'boolean' },
                },
              },
            },
          },
        },
        ...errors,
      },
    },
    post: {
      tags,
      summary: 'Share a group of songs',
      description:
        'Publishes the whole library (categoryIds null) or chosen categories and songs as a shared library through the sync service, in a new folder with its own link: hash-named gzipped shards of about 500 songs plus a manifest under libraries/<sourceId>/, unlisted by default or listed in the public catalog. Kept in sync every 5 minutes. Requires `settings.edit`.',
      security,
      requestBody: shareBody,
      responses: {
        '201': { description: 'The new share', content: dataOf(share) },
        '400': { description: 'No category or song chosen' },
        '409': { description: 'Cloud sync is off (cloud_sync_off)' },
        '502': { description: 'The sync service failed' },
        ...errors,
      },
    },
  },
  '/api/song-sources/shares/{id}': {
    put: {
      tags,
      summary: 'Change what a share shares',
      description:
        'Saves its name, contents and listing, then publishes it again at the same link. Requires `settings.edit`.',
      security,
      parameters: [idParameter('integer')],
      requestBody: shareBody,
      responses: {
        '200': { description: 'The share', content: dataOf(share) },
        '400': { description: 'No category or song chosen' },
        '404': { description: 'Share not found' },
        '409': { description: 'Cloud sync is off (cloud_sync_off)' },
        '502': { description: 'The sync service failed' },
        ...errors,
      },
    },
    delete: {
      tags,
      summary: 'Stop a share',
      description:
        'The service deletes its library from the catalog and the bucket, so its link stops working. Requires `settings.edit`.',
      security,
      parameters: [idParameter('integer')],
      responses: {
        '200': { description: 'Stopped' },
        '502': { description: 'The sync service failed' },
        ...errors,
      },
    },
  },
  '/api/song-sources/shares/{id}/sync': {
    post: {
      tags,
      summary: 'Publish a share again now',
      description:
        'Uploads only the shards the bucket lacks, then the manifest. Requires `settings.edit`.',
      security,
      parameters: [idParameter('integer')],
      responses: {
        '200': { description: 'The share', content: dataOf(share) },
        '404': { description: 'Share not found' },
        '502': { description: 'The sync service failed' },
        ...errors,
      },
    },
  },
  '/api/song-sources/catalog': {
    get: {
      tags,
      summary: 'The shared libraries in the public catalog',
      description:
        'The libraries churches listed (libraries/catalog.json), each with the manifest URL to add as a song source. Requires `songs.view`.',
      security,
      responses: {
        '200': {
          description: 'Listed libraries',
          content: dataOf({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceId: { type: 'string' },
                name: { type: 'string' },
                publisher: { type: 'string' },
                songCount: { type: 'integer' },
                updatedAt: { type: 'string' },
                manifestUrl: { type: 'string' },
              },
            },
          }),
        },
        '502': { description: 'The catalog could not be read' },
        ...errors,
      },
    },
  },
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
        'For `song-bundle-file` sources: the `.chsongs` file, downloaded by the server (links are checked to reach public addresses only). A built-in source’s file (from Church Hub’s `song-sources` GitHub release) is refused with 502 when it is damaged (a ZIP entry’s CRC-32 differs) or its manifest’s checksum differs from the `.sha256` published next to it. Requires `songs.create`.',
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
  '/api/song-sources/{id}/changed': {
    get: {
      tags,
      summary: 'Get the library songs a source changed, for review',
      description:
        'From the last check, while syncing without approval is off: each library song (never one edited by hand) with its current title and slides beside the source’s newer version. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The changed songs',
          content: dataOf({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                songId: { type: 'integer' },
                library: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    slides: { type: 'array', items: { type: 'string' } },
                  },
                },
                song: {
                  type: 'object',
                  description:
                    'The source’s version: id, sourceFilename, parsed',
                },
              },
            },
          }),
        },
        '404': { description: 'No such source' },
        ...errors,
      },
    },
    post: {
      tags,
      summary: 'Update or keep some of the library songs a source changed',
      description:
        '`update` gives them the source’s lyrics (a song edited by hand is never replaced); `keep` keeps the library’s, and that version of the source’s is not offered again. Either way they stop waiting for approval. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['songIds', 'action'],
              properties: {
                songIds: { type: 'array', items: { type: 'integer' } },
                action: { type: 'string', enum: ['update', 'keep'] },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
        '400': { description: 'songIds or action missing' },
        '404': { description: 'No such source' },
        '409': { description: 'The song sources are being checked' },
        ...errors,
      },
    },
  },
  '/api/song-sources/{id}/recount': {
    post: {
      tags,
      summary: 'Count a source’s waiting songs again',
      description:
        'After songs were imported in Song discovery: the counts and the “waiting for approval” notification then match what is left. Requires `songs.create`.',
      security,
      parameters: [idParameter('string')],
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
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
        'The sources are checked in a worker thread a bit after the server starts (only when the internet answers), then daily: a source whose checksum did not change is not downloaded again. When syncing without approval (the default), songs with no similar version in the library are added to the source’s category and library songs nobody edited by hand get the source’s newer lyrics; otherwise they wait for POST /api/song-sources/updates/sync. Each run is recorded in the notifications. Requires `songs.view`.',
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
  '/api/song-sources/updates/cancel': {
    post: {
      tags,
      summary: 'Stop the running check',
      description:
        'What it saved so far stays. Nothing happens when no check runs. Requires `songs.create`.',
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
  '/api/song-sources/updates/sync': {
    post: {
      tags,
      summary: 'Sync the songs waiting for approval',
      description:
        'Adds every source’s waiting new songs and updates the library songs the sources changed (never a song edited by hand), and records a “songs synced” notification. Requires `songs.create`.',
      security,
      responses: {
        '200': {
          description: 'The song updates',
          content: dataOf(songUpdates),
        },
        '409': { description: 'A check is running' },
        ...errors,
      },
    },
  },
  '/api/song-sources/updates/settings': {
    put: {
      tags,
      summary: 'Turn syncing without approval on or off',
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
        'An empty secret keeps the stored one, but only for the same endpoint: with a new endpoint the secret must be sent again (400 otherwise). Requires `settings.edit`.',
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
        '400': {
          description:
            'A field is missing or not a URL, or the endpoint changed with no secret sent',
        },
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
