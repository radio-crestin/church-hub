export const backgroundMediaSchemas = {
  BackgroundMediaKind: {
    type: 'string',
    enum: ['image', 'video'],
    description: 'Whether the background is a still image or a video',
  },
  BackgroundMedia: {
    type: 'object',
    required: ['id', 'kind', 'mimeType', 'size', 'url', 'createdAt'],
    properties: {
      id: {
        type: 'string',
        pattern:
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|gif|mp4|webm)$',
        description: 'Stored file name: `<uuid v4>.<ext>`',
        example: '0b8e6f4a-2c1d-4e5f-9a7b-3c2d1e0f9a8b.mp4',
      },
      kind: { $ref: '#/components/schemas/BackgroundMediaKind' },
      mimeType: {
        type: 'string',
        enum: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/webm',
        ],
      },
      size: { type: 'integer', description: 'File size in bytes' },
      url: {
        type: 'string',
        description:
          'Relative URL serving the file; store it in a screen config `background.imageUrl` / `background.videoUrl`',
        example:
          '/api/media/backgrounds/0b8e6f4a-2c1d-4e5f-9a7b-3c2d1e0f9a8b.mp4',
      },
      createdAt: {
        type: 'integer',
        description: 'Upload time (file mtime), milliseconds since epoch',
      },
    },
  },
}
