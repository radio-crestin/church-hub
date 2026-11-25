/**
 * A presentation's music, video and verses items: their settings, playing a
 * music item, picking the random ones again, and putting up a step the
 * server builds (service/schedule-items).
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Schedules']

const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
  description: 'Presentation ID',
}
const itemId = {
  name: 'itemId',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}
const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
}

export const scheduleItemsPaths = {
  '/api/schedules/{id}/items/{itemId}/config': {
    put: {
      tags,
      summary: "Change an item's settings",
      description:
        "A music, video or verses item's settings, or how many of a Versete Biblice slide's passages it shows ({ count: null } = all, in order). Its random picks are made again. Needs programs.edit",
      security,
      parameters: [id, itemId],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['itemConfig'],
              properties: {
                itemConfig: { $ref: '#/components/schemas/ScheduleItemConfig' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The item, with its new picks',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleItem' },
                },
              },
            },
          },
        },
        '400': {
          description: "Settings that don't fit the item, or no such item",
        },
        ...errors,
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/play': {
    post: {
      tags,
      summary: 'Play a music item now',
      description:
        "Its tracks replace the music player's queue (shuffled when it shuffles) and play from the first. Needs control_room.control",
      security,
      parameters: [id, itemId],
      responses: {
        '200': { description: 'Playing' },
        '404': { description: 'No such music item' },
        ...errors,
      },
    },
  },
  '/api/schedules/{id}/repick': {
    post: {
      tags,
      summary: 'Pick the random verses and videos again',
      description:
        'As a new run or loop does. Pages showing the presentation get a schedule_picks WebSocket message. Needs control_room.control',
      security,
      parameters: [id],
      responses: {
        '200': {
          description: 'The presentation with its new picks',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleWithItems' },
                },
              },
            },
          },
        },
        '404': { description: 'Presentation not found' },
        ...errors,
      },
    },
  },
  '/api/schedules/{id}/steps/{index}/present': {
    post: {
      tags,
      summary: 'Put a step of the presentation up',
      description:
        "The step at this position of the running order, built by the server as the presentation's runner does (a video item plays full screen). Needs control_room.control",
      security,
      parameters: [
        id,
        {
          name: 'index',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': { description: 'The presentation state' },
        '404': { description: 'No such step' },
        ...errors,
      },
    },
  },
}
