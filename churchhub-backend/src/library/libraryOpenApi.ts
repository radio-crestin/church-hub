/**
 * The OpenAPI paths of shared libraries and the curated Church Hub Library
 * (T-177), merged into
 * the service's document (sync/openapi.ts).
 */
const error = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
})

const ok = (description: string, properties: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': { schema: { type: 'object', properties } },
  },
})

const json = (properties: Record<string, unknown>, required: string[]) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, required },
    },
  },
})

const curatorErrors = {
  '401': error('Missing, forged or expired ticket (owner_unauthorized)'),
  '403': error('The account is not in LIBRARY_CURATORS (not_curator)'),
}

const submission = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    submittedAt: { type: 'number', description: 'Unix ms' },
    title: { type: 'string' },
    xml: { type: 'string', description: 'The song as OpenSong XML' },
    sourceSongId: { type: ['string', 'null'] },
    churchName: { type: ['string', 'null'] },
    note: { type: ['string', 'null'] },
    batchId: { type: 'string', description: 'Shared by the songs sent together' },
    batchSize: { type: 'integer' },
  },
}

const sourceId = {
  name: 'sourceId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' },
  description: 'church-hub (the curated library) or <churchId>-<random>',
}

const writeErrors = {
  '400': error('Invalid library id, shard or manifest'),
  '401': error('Missing or invalid ticket or token'),
  '403': error('Not allowed to publish this library (not_curator, forbidden)'),
}

export const libraryOpenApiPaths = {
  '/sync/libraries': {
    get: {
      summary: 'Where the catalog of listed libraries is read from',
      description:
        'The public URL of libraries/catalog.json: {format: church-hub-library-catalog, version: 1, libraries: [{sourceId, name, publisher, songCount, updatedAt}]}, the libraries their publishers listed. A library’s manifest is at <sourceId>/manifest.json next to it.',
      responses: {
        '200': ok('Their URLs', {
          catalogUrl: { type: 'string' },
          featuredUrl: {
            type: 'string',
            description:
              'libraries/featured.json: {format: church-hub-featured-sources, version: 1, updatedAt, sources: [{sourceId, name, categoryName, description, homepage, license}]}, the sources every app lists',
          },
        }),
      },
    },
  },
  '/sync/featured-sources': {
    put: {
      summary: 'Publish the sources every app lists',
      description:
        'The libraries Church Hub manages (no church’s: the curated one, Resurse Creștine…) every app offers, in order. Each must be published already. A curator ticket or the build’s LIBRARY_PUBLISH_TOKEN.',
      security: [{ ownerTicket: [] }, { publishToken: [] }],
      requestBody: json(
        {
          sources: {
            type: 'array',
            maxItems: 100,
            items: {
              type: 'object',
              properties: {
                sourceId: { type: 'string' },
                name: { type: 'string' },
                categoryName: { type: 'string' },
                description: { type: 'string' },
                homepage: { type: 'string' },
                license: { type: 'string' },
              },
              required: ['sourceId', 'name', 'categoryName'],
            },
          },
        },
        ['sources']
      ),
      responses: {
        '200': ok('Published', {
          format: { type: 'string' },
          version: { type: 'integer' },
          updatedAt: { type: 'string' },
          sources: { type: 'array', items: { type: 'object' } },
        }),
        ...writeErrors,
        '400': error('Not a list, a church’s library, or one not published yet (invalid_request, not_published)'),
      },
    },
  },
  '/sync/libraries/{sourceId}': {
    get: {
      summary: 'Where a library is read from',
      description:
        'The public URL of libraries/<sourceId>/manifest.json: the song bundle manifest (version 3, app/packages/song-formats/src/library/types.ts) listing every song with its hash, fingerprint and the shard (shards/<sha256>.json.gz, cached forever) holding it. Readers GET it and its shards straight from the bucket.',
      parameters: [sourceId],
      responses: {
        '200': ok('Its manifest URL', { manifestUrl: { type: 'string' } }),
      },
    },
    delete: {
      summary: 'Stop sharing a library',
      description:
        'Takes it out of the catalog, then deletes its manifest and shards. Only its publisher: a church’s token with songs.edit for <churchId>-…, a curator for church-hub.',
      security: [{ ownerTicket: [] }, { deviceToken: [] }],
      parameters: [sourceId],
      responses: {
        '200': ok('Deleted', { deleted: { type: 'boolean' } }),
        ...writeErrors,
      },
    },
  },
  '/sync/libraries/{sourceId}/shards/{hash}': {
    put: {
      summary: 'Store a library shard',
      description:
        'The gzipped shard JSON a PC built; hash is the sha256 of the uncompressed JSON, checked. Content-addressed: a shard already stored is left as it is (200). church-hub needs a curator ticket; a church’s own library (<churchId>-…) its token with songs.edit.',
      security: [{ ownerTicket: [] }, { deviceToken: [] }],
      parameters: [
        sourceId,
        { name: 'hash', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-f]{64}$' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/gzip': { schema: { type: 'string', format: 'binary' } } },
      },
      responses: {
        '200': ok('Stored', { stored: { type: 'boolean' } }),
        ...writeErrors,
        '413': error('Over 4 MB (too_large)'),
      },
    },
  },
  '/sync/libraries/{sourceId}/manifest': {
    put: {
      summary: 'Publish a library’s next manifest',
      description:
        'Built by the PC from the manifest with baseChecksum (null: the first publish). Checked: bundle version 3, its sourceId, every shard named by its hash and already stored. Written with If-Match on the ETag read; afterwards the shards neither this nor the previous manifest lists are deleted, and the public catalog (libraries/catalog.json: {format: church-hub-library-catalog, version: 1, libraries: [{sourceId, name, publisher, songCount, updatedAt}]}) lists the library when manifest.listed is true, and no longer lists it otherwise.',
      security: [{ ownerTicket: [] }, { deviceToken: [] }],
      parameters: [sourceId],
      requestBody: json(
        {
          baseChecksum: { type: ['string', 'null'] },
          manifest: { type: 'object' },
        },
        ['baseChecksum', 'manifest']
      ),
      responses: {
        '200': ok('Published', { checksum: { type: 'string' } }),
        ...writeErrors,
        '409': error('Published by someone else meanwhile (library_changed, with the current checksum)'),
        '413': error('Over 32 MB (too_large)'),
      },
    },
  },
  '/sync/libraries/church-hub/submissions': {
    post: {
      summary: 'Submit songs to the Church Hub Library',
      description:
        'A church sends one song or many (a category, a selection: up to 500), each as its OpenSong file, for the curators to review. Each song becomes its own submission, decided on its own; they share a batchId. Kept privately until decided. Rate-limited per IP (LIBRARY_RATE_LIMITER), one request whatever its size.',
      requestBody: json(
        {
          songs: {
            type: 'array',
            minItems: 1,
            maxItems: 500,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', maxLength: 200 },
                xml: { type: 'string', description: 'OpenSong XML, under 200 KB' },
                sourceSongId: { type: 'string' },
              },
              required: ['title', 'xml'],
            },
          },
          churchName: { type: 'string' },
          note: { type: 'string', maxLength: 1000 },
        },
        ['songs']
      ),
      responses: {
        '201': ok('Received', {
          batchId: { type: 'string' },
          submitted: { type: 'integer' },
        }),
        '400': error('No songs, too many, or one is not an OpenSong song (invalid_request)'),
        '413': error('Body over 16 MB (too_large)'),
        '429': error('Too many submissions (rate_limited)'),
      },
    },
    get: {
      summary: 'The submissions waiting for a curator',
      security: [{ ownerTicket: [] }],
      responses: {
        '200': ok('Oldest first', {
          submissions: { type: 'array', items: submission },
        }),
        ...curatorErrors,
      },
    },
  },
  '/sync/libraries/church-hub/curator': {
    get: {
      summary: 'Whether the signed-in account is a curator',
      security: [{ ownerTicket: [] }],
      responses: {
        '200': ok('The account', {
          email: { type: 'string' },
          curator: { type: 'boolean' },
        }),
        '401': curatorErrors['401'],
      },
    },
  },
  '/sync/libraries/church-hub/submissions/{id}/decision': {
    post: {
      summary: 'Record a curator’s decision',
      description:
        'approved (a new library song) or merged (the new version of an existing one): after the curator’s PC published the library with librarySongId in it, which is checked. rejected: nothing is published.',
      security: [{ ownerTicket: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: json(
        {
          decision: { enum: ['approved', 'merged', 'rejected'] },
          librarySongId: { type: 'string', description: 'For approved and merged' },
          reason: { type: 'string', description: 'For rejected' },
        },
        ['decision']
      ),
      responses: {
        '200': ok('Decided', {
          id: { type: 'string' },
          decision: { type: 'string' },
          librarySongId: { type: ['string', 'null'] },
        }),
        '400': error('Invalid decision (invalid_request)'),
        ...curatorErrors,
        '404': error('No such pending submission (not_found)'),
        '409': error('The song is not in the published library (not_published)'),
      },
    },
  },
}
