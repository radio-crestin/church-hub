/**
 * The YouTube side of the livestream: the settings every new broadcast is
 * created with, the broadcast itself, and what the settings page reads from
 * YouTube (past broadcasts as templates, video categories).
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Livestream']

const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '500': { description: 'YouTube answered with an error, or is not connected' },
}

const json = (schema: object, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: schema } },
    },
  },
})

const privacy = { type: 'string', enum: ['public', 'unlisted', 'private'] }
const latency = { type: 'string', enum: ['normal', 'low', 'ultraLow'] }

const settings = {
  titleTemplate: {
    type: 'string',
    description:
      'A date in it (16.11.2025, 2025-11-16, 16 noiembrie 2025) becomes the day of the stream.',
  },
  description: { type: 'string' },
  privacyStatus: privacy,
  streamKeyId: { type: 'string', description: 'The liveStream it is bound to' },
  playlistId: { type: 'string', description: 'Each new broadcast joins it' },
  selectedBroadcastId: {
    type: 'string',
    description: 'The past broadcast the settings were taken from',
  },
  categoryId: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } },
  madeForKids: { type: 'boolean' },
  latencyPreference: latency,
  enableDvr: { type: 'boolean', description: 'Off by default' },
  enableAutoStart: { type: 'boolean' },
  enableAutoStop: { type: 'boolean' },
  thumbnailUrl: {
    type: 'string',
    description: 'Image uploaded as each new broadcast’s thumbnail',
  },
}

const config = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    ...settings,
    startSceneName: { type: 'string', nullable: true },
    stopSceneName: { type: 'string', nullable: true },
    broadcastMode: { type: 'string', enum: ['create', 'reuse'] },
  },
}

const broadcast = {
  type: 'object',
  properties: {
    broadcastId: { type: 'string' },
    title: { type: 'string' },
    url: { type: 'string', example: 'https://youtu.be/abc123' },
    status: { type: 'string', enum: ['scheduled', 'live', 'ended', 'deleted'] },
    scheduledStartTime: { type: 'string', format: 'date-time' },
  },
}

export const livestreamYouTubePaths = {
  '/api/livestream/youtube/config': {
    get: {
      tags,
      summary: 'The settings new broadcasts are created with',
      security,
      responses: { '200': json(config, 'The settings'), ...errors },
    },
    put: {
      tags,
      summary: 'Change the broadcast settings',
      description: 'Only the given settings change; `null` clears one.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', properties: settings },
          },
        },
      },
      responses: {
        '200': json(config, 'The settings now'),
        '400': { description: 'Not JSON' },
        ...errors,
      },
    },
  },
  '/api/livestream/youtube/broadcast': {
    post: {
      tags,
      summary: 'Create a broadcast with the saved settings',
      description:
        'liveBroadcasts.insert (title, description, privacy, made for kids, latency, DVR, auto-start/stop), bound to the stream key; then the category and tags (videos.update), the thumbnail (thumbnails.set) and the playlist. A failed category, thumbnail or playlist step is logged and skipped.',
      security,
      responses: { '201': json(broadcast, 'The broadcast'), ...errors },
    },
  },
  '/api/livestream/youtube/broadcasts/completed': {
    get: {
      tags,
      summary: 'The channel’s last 10 past broadcasts, newest first',
      security,
      responses: {
        '200': json(
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                broadcastId: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                privacyStatus: privacy,
                completedAt: { type: 'string', format: 'date-time' },
                boundStreamId: { type: 'string' },
              },
            },
          },
          'The past broadcasts',
        ),
        ...errors,
      },
    },
  },
  '/api/livestream/youtube/broadcasts/{id}/template': {
    get: {
      tags,
      summary: 'A past broadcast’s settings, to start new ones from',
      description:
        'Title, description, privacy, stream key, latency, auto-start/stop, category, tags, made for kids and thumbnail. DVR is not taken: it stays the operator’s choice.',
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': json({ type: 'object', properties: settings }, 'Its settings'),
        ...errors,
      },
    },
  },
  '/api/livestream/youtube/categories': {
    get: {
      tags,
      summary: 'The categories a broadcast’s video can be given',
      security,
      parameters: [
        {
          name: 'hl',
          in: 'query',
          description: 'Language of the names, e.g. `ro`',
          schema: { type: 'string', default: 'en' },
        },
      ],
      responses: {
        '200': json(
          {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, title: { type: 'string' } },
            },
          },
          'The categories',
        ),
        ...errors,
      },
    },
  },
}
