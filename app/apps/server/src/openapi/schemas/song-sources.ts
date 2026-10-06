export const songSourceSchemas = {
  SongSource: {
    type: 'object',
    description:
      'A place songs are imported from: a built-in config file shipped with the app, or a link someone shared',
    required: ['id', 'name', 'categoryName', 'format', 'url', 'origin'],
    properties: {
      id: { type: 'string', example: 'laudele-domnului' },
      name: { type: 'string', example: 'Laudele Domnului' },
      categoryName: {
        type: 'string',
        description: 'Category its songs land in, created on import if missing',
      },
      format: {
        type: 'string',
        enum: [
          'opensong-zip',
          'cantaricrestine-api',
          'song-bundle-file',
          'song-bundle-folder',
        ],
      },
      url: { type: 'string', format: 'uri' },
      homepage: { type: 'string', format: 'uri' },
      license: { type: 'string' },
      origin: { type: 'string', enum: ['built-in', 'link'] },
    },
  },
  SongBundleFile: {
    type: 'object',
    description:
      'One song of a song bundle: its OpenSong file, named after the song',
    properties: {
      id: { type: 'string', description: 'The song’s uuid' },
      path: { type: 'string', example: '001 - Lauda pe Domnul.opensong' },
      xml: { type: 'string', description: 'OpenSong XML' },
    },
  },
  S3Storage: {
    type: 'object',
    description:
      'The S3-compatible bucket published sources go to. The secret key is never returned.',
    properties: {
      endpoint: { type: 'string', format: 'uri' },
      region: { type: 'string', nullable: true },
      bucket: { type: 'string' },
      pathPrefix: { type: 'string' },
      accessKeyId: { type: 'string' },
      publicBaseUrl: {
        type: 'string',
        format: 'uri',
        description: 'Public, read-only URL of the bucket',
      },
      hasSecret: { type: 'boolean' },
    },
  },
  S3StorageInput: {
    type: 'object',
    required: ['endpoint', 'bucket', 'accessKeyId', 'publicBaseUrl'],
    properties: {
      endpoint: { type: 'string', format: 'uri' },
      region: { type: 'string', nullable: true },
      bucket: { type: 'string' },
      pathPrefix: { type: 'string' },
      accessKeyId: { type: 'string' },
      secretAccessKey: {
        type: 'string',
        description: 'Leave empty to keep the stored secret',
      },
      publicBaseUrl: { type: 'string', format: 'uri' },
    },
  },
  SongSourcePublication: {
    type: 'object',
    description: 'A category published to the S3 bucket as a shared source',
    properties: {
      id: { type: 'integer' },
      categoryId: { type: 'integer' },
      categoryName: { type: 'string' },
      shareUrl: {
        type: 'string',
        format: 'uri',
        nullable: true,
        description: 'Public link of its manifest.json, to share',
      },
      songCount: { type: 'integer' },
      lastSyncedAt: { type: 'integer', nullable: true },
      lastError: { type: 'string', nullable: true },
    },
  },
}
