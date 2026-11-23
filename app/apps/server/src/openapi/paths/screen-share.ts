const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
})

export const screenSharePaths = {
  '/api/screen-share/start': {
    post: {
      tags: ['Screen Share'],
      summary: 'Start a screen share',
      description:
        'Puts the screen share on the screens (replacing any running share) and returns the ingest token the sharer sends its frames with. The desktop app captures natively in Rust; a browser operator captures with getDisplayMedia.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                scheduleId: { type: 'integer' },
                scheduleItemIndex: { type: 'integer' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The share is on the screens',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      token: {
                        type: 'string',
                        description:
                          'Send it as X-Screen-Share-Token with every frame',
                      },
                    },
                    required: ['token'],
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/screen-share/stop': {
    post: {
      tags: ['Screen Share'],
      summary: 'Stop the screen share',
      description:
        'Ends the share, closes every viewer stream and takes the share off the screens.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The presentation state after the share ended',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/PresentationState' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/screen-share/frame': {
    post: {
      tags: ['Screen Share'],
      summary: 'Send one frame of the share',
      description:
        'One JPEG frame from the sharer, relayed to every open stream. Frames stop being accepted when the share ends or other content replaces it on the screens; with no frame for 15 seconds the share ends by itself.',
      parameters: [
        {
          name: 'X-Screen-Share-Token',
          in: 'header',
          required: true,
          schema: { type: 'string' },
          description: 'The token from POST /api/screen-share/start',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'image/jpeg': { schema: { type: 'string', format: 'binary' } },
        },
      },
      responses: {
        '204': { description: 'Frame accepted' },
        '403': errorResponse('Wrong ingest token'),
        '409': errorResponse('No screen share running'),
        '413': errorResponse('Empty frame, or larger than 8 MB'),
      },
    },
  },
  '/api/screen-share/stream.mjpg': {
    get: {
      tags: ['Screen Share'],
      summary: 'Watch the screen share',
      description:
        'The share as an MJPEG stream (multipart/x-mixed-replace), for an <img> on the browser screens. It starts with the latest frame and ends when the share ends; a slow viewer skips frames instead of falling behind.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The live stream',
          content: {
            'multipart/x-mixed-replace': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': errorResponse('No screen share running'),
      },
    },
  },
}
