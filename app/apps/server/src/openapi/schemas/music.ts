const timestamp = (description: string) => ({
  type: 'integer',
  description: `${description} (Unix ms)`,
})
const nullableInteger = (description: string) => ({
  type: ['integer', 'null'],
  description,
})
const nullableString = { type: ['string', 'null'] }

export const musicSchemas = {
  MusicFolder: {
    type: 'object',
    description: 'A folder on disk whose audio files make up the library',
    required: ['id', 'path', 'name', 'isRecursive', 'fileCount'],
    properties: {
      id: { type: 'integer' },
      path: { type: 'string', example: '/home/user/Music/Worship' },
      name: { type: 'string', example: 'Worship' },
      isRecursive: {
        type: 'boolean',
        description: 'Whether subfolders are scanned too',
      },
      lastSyncAt: {
        type: ['integer', 'null'],
        description: 'Last scan (Unix ms), null before the first',
      },
      fileCount: { type: 'integer' },
      createdAt: timestamp('Created'),
      updatedAt: timestamp('Last updated'),
    },
  },
  MusicFile: {
    type: 'object',
    description: 'An audio file of a music folder, with its tags',
    required: ['id', 'folderId', 'path', 'filename', 'format', 'playCount'],
    properties: {
      id: { type: 'integer' },
      folderId: { type: 'integer' },
      path: { type: 'string' },
      filename: { type: 'string', example: 'Amazing Grace.mp3' },
      title: nullableString,
      artist: nullableString,
      album: nullableString,
      genre: nullableString,
      year: nullableInteger('Release year'),
      trackNumber: nullableInteger('Track number on its album'),
      duration: {
        type: ['number', 'null'],
        description: 'Length in seconds',
      },
      format: { type: 'string', enum: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
      fileSize: nullableInteger('Size in bytes'),
      lastModified: nullableInteger('File modification time (Unix ms)'),
      playCount: {
        type: 'integer',
        description: 'How many times it was played',
      },
      lastPlayedAt: nullableInteger(
        'When it was last played (Unix ms), null if never',
      ),
      createdAt: timestamp('Created'),
      updatedAt: timestamp('Last updated'),
    },
  },
  MusicPlaylist: {
    type: 'object',
    required: ['id', 'name', 'itemCount', 'totalDuration'],
    properties: {
      id: { type: 'integer' },
      name: { type: 'string', example: 'Sunday prelude' },
      description: nullableString,
      itemCount: { type: 'integer' },
      totalDuration: {
        type: 'number',
        description: 'Sum of its tracks’ durations, in seconds',
      },
      createdAt: timestamp('Created'),
      updatedAt: timestamp('Last updated'),
    },
  },
  MusicPlaylistItem: {
    type: 'object',
    required: ['id', 'playlistId', 'fileId', 'sortOrder', 'file'],
    properties: {
      id: { type: 'integer' },
      playlistId: { type: 'integer' },
      fileId: { type: 'integer' },
      sortOrder: { type: 'integer' },
      file: { $ref: '#/components/schemas/MusicFile' },
      createdAt: timestamp('Added'),
    },
  },
  MusicPlaylistWithItems: {
    allOf: [
      { $ref: '#/components/schemas/MusicPlaylist' },
      {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            description: 'In playlist order',
            items: { $ref: '#/components/schemas/MusicPlaylistItem' },
          },
        },
      },
    ],
  },
  SyncResult: {
    type: 'object',
    description: 'What a folder scan changed in the library',
    required: [
      'success',
      'filesAdded',
      'filesRemoved',
      'filesUpdated',
      'errors',
    ],
    properties: {
      success: { type: 'boolean' },
      filesAdded: { type: 'integer' },
      filesRemoved: { type: 'integer' },
      filesUpdated: { type: 'integer' },
      errors: { type: 'array', items: { type: 'string' } },
    },
  },
  MusicPlayerStatus: {
    type: 'object',
    description: 'Whether the embedded audio player can play',
    required: ['available', 'installed'],
    properties: {
      available: {
        type: 'boolean',
        description: 'The audio server started and answers',
      },
      installed: {
        type: 'boolean',
        description: 'Always true: the player is embedded in the app',
      },
    },
  },
}
