/**
 * The notifications history: the song sync's results and new app versions,
 * kept 60 days (older ones are deleted at start and daily).
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Notifications']

const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
}
const ok = {
  description: 'Done',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
    },
  },
}

const songSet = {
  type: 'object',
  properties: {
    count: { type: 'integer' },
    songs: {
      type: 'array',
      description: 'The first 100, by title; `id` once in the library',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, title: { type: 'string' } },
      },
    },
  },
}

const notification = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'songs-synced:1791280000000' },
    kind: {
      type: 'string',
      enum: ['songs-synced', 'songs-pending', 'app-update'],
    },
    data: {
      type: 'object',
      description:
        'songs-synced and songs-pending: `{ sources: [{ sourceId, name, added, updated }] }` (added and updated are song sets). app-update: `{ version }`.',
      properties: {
        version: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceId: { type: 'string' },
              name: { type: 'string' },
              added: songSet,
              updated: songSet,
            },
          },
        },
      },
    },
    createdAt: { type: 'integer', description: 'Unix time, ms' },
    readAt: { type: 'integer', nullable: true },
  },
}

export const notificationsPaths = {
  '/api/notifications': {
    get: {
      tags,
      summary: 'List the notifications of the last 60 days',
      description:
        'Newest first. The song sync’s notifications only for users with `songs.view`.',
      security,
      responses: {
        '200': {
          description: 'The notifications',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: { type: 'array', items: notification } },
              },
            },
          },
        },
        ...errors,
      },
    },
    delete: {
      tags,
      summary: 'Remove every notification',
      description:
        'Those the user sees: without `songs.view`, the song sync’s stay.',
      security,
      responses: {
        '200': {
          description: 'How many were removed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { removed: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
        ...errors,
      },
    },
  },
  '/api/notifications/read': {
    post: {
      tags,
      summary: 'Mark every notification read',
      security,
      responses: { '200': ok, ...errors },
    },
  },
  '/api/notifications/app-update': {
    post: {
      tags,
      summary: 'Record a new app version',
      description:
        'The app finds updates itself (the updater plugin); it records each new version here once, so it is in the history.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['version'],
              properties: { version: { type: 'string', example: '0.1.104' } },
            },
          },
        },
      },
      responses: {
        '200': ok,
        '400': { description: 'Not a version number' },
        ...errors,
      },
    },
  },
  '/api/notifications/{id}': {
    delete: {
      tags,
      summary: 'Remove a notification',
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': ok,
        '404': { description: 'No such notification' },
        ...errors,
      },
    },
  },
}
