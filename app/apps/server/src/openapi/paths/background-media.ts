const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
})

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Media id (`<uuid v4>.<ext>`) as returned by the upload',
  schema: {
    type: 'string',
    pattern:
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|gif|mp4|webm)$',
  },
}

const rangeParameter = {
  name: 'Range',
  in: 'header',
  required: false,
  description:
    'Single byte range: `bytes=a-b`, `bytes=a-` or `bytes=-n`. Malformed or multi-range values are ignored (full file, 200).',
  schema: { type: 'string', example: 'bytes=0-1048575' },
}

const fileHeaders = {
  'Accept-Ranges': { schema: { type: 'string', example: 'bytes' } },
  'Cache-Control': {
    schema: {
      type: 'string',
      example: 'public, max-age=31536000, immutable',
    },
  },
  'Content-Length': { schema: { type: 'integer' } },
}

const binaryContent = {
  'image/*': { schema: { type: 'string', format: 'binary' } },
  'video/*': { schema: { type: 'string', format: 'binary' } },
}

const fileResponses = {
  '200': {
    description: 'Whole file (no or ignored `Range` header)',
    headers: fileHeaders,
    content: binaryContent,
  },
  '206': {
    description: 'Requested byte range',
    headers: {
      ...fileHeaders,
      'Content-Range': {
        schema: { type: 'string', example: 'bytes 0-1048575/73400320' },
      },
    },
    content: binaryContent,
  },
  '400': errorResponse('Malformed media id'),
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': errorResponse('Missing `displays.view` permission'),
  '404': errorResponse('Background media not found'),
  '416': {
    description: 'Range starts past the end of the file (empty body)',
    headers: {
      'Content-Range': {
        schema: { type: 'string', example: 'bytes */73400320' },
      },
    },
  },
}

export const backgroundMediaPaths = {
  '/api/media/backgrounds': {
    get: {
      tags: ['Background Media'],
      summary: 'List uploaded screen backgrounds',
      description:
        'Returns every uploaded background image/video, newest first. Requires `displays.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Uploaded backgrounds',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BackgroundMedia' },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': errorResponse('Missing `displays.view` permission'),
      },
    },
    post: {
      tags: ['Background Media'],
      summary: 'Upload a screen background image or video',
      description:
        'The request body is the raw file (not multipart) and `Content-Type` is its MIME type. Accepted: image/jpeg, image/png, image/webp, image/gif (max 50 MiB) and video/mp4, video/webm (max 1 GiB). The body is streamed to disk; an upload that exceeds the limit is aborted and discarded. Store the returned `url` in a screen config background (`imageUrl` / `videoUrl`). Requires `displays.edit`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'name',
          in: 'query',
          required: false,
          description: 'Original file name, used for logging only',
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'image/jpeg': { schema: { type: 'string', format: 'binary' } },
          'image/png': { schema: { type: 'string', format: 'binary' } },
          'image/webp': { schema: { type: 'string', format: 'binary' } },
          'image/gif': { schema: { type: 'string', format: 'binary' } },
          'video/mp4': { schema: { type: 'string', format: 'binary' } },
          'video/webm': { schema: { type: 'string', format: 'binary' } },
        },
      },
      responses: {
        '201': {
          description: 'Background stored',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BackgroundMedia' },
                },
              },
            },
          },
        },
        '400': errorResponse('Empty request body'),
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': errorResponse('Missing `displays.edit` permission'),
        '413': errorResponse(
          'File larger than the limit for its kind (50 MiB images, 1 GiB videos)',
        ),
        '415': errorResponse('Missing or unsupported `Content-Type`'),
      },
    },
  },
  '/api/media/backgrounds/{id}': {
    get: {
      tags: ['Background Media'],
      summary: 'Download a screen background',
      description:
        'Serves the file bytes with HTTP Range support (needed by WebKit to play mp4). Loaded directly by `<img>` / `<video>` elements, so it relies on the session cookie or, for cookie-less localhost display windows, the view-only localhost access. Requires `displays.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [idParameter, rangeParameter],
      responses: fileResponses,
    },
    head: {
      tags: ['Background Media'],
      summary: 'Get the headers of a screen background',
      description:
        'Same status and headers as GET (including range handling) without a body. Requires `displays.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [idParameter, rangeParameter],
      responses: fileResponses,
    },
    delete: {
      tags: ['Background Media'],
      summary: 'Delete a screen background',
      description:
        'Removes the file. Screen configs that still reference its URL are not changed. Requires `displays.edit`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [idParameter],
      responses: {
        '200': {
          description: 'Background deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { success: { type: 'boolean', const: true } },
                  },
                },
              },
            },
          },
        },
        '400': errorResponse('Malformed media id'),
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': errorResponse('Missing `displays.edit` permission'),
        '404': errorResponse('Background media not found'),
      },
    },
  },
}
