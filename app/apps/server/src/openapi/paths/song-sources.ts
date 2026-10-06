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
      summary: 'Read a song bundle source’s songs',
      description:
        'For `song-bundle-file` and `song-bundle-folder` sources. A folder downloads only the songs whose hash changed since the last read. Requires `songs.create`.',
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
