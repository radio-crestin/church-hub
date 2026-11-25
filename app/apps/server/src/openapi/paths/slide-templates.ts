/**
 * Slide templates (CH-184): how every kind of slide looks. Screens,
 * presentations and their items point to one; bundled ones are read-only.
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Slide Templates']

const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { description: 'Missing the displays permission' },
}

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}

const design = {
  width: { type: 'integer', description: 'Design canvas width in px' },
  height: { type: 'integer', description: 'Design canvas height in px' },
  layouts: {
    type: 'object',
    description:
      'One layout per slide kind (song, song_first_slide, song_last_slide, bible, bible_passage, announcement, versete_tineri, empty, screen_share): background, elements, styles, transitions',
  },
  globalSettings: { $ref: '#/components/schemas/ScreenGlobalSettings' },
  nextSlide: { $ref: '#/components/schemas/NextSlideSectionConfig' },
}

const template = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string', example: 'Main' },
    bundledKey: {
      type: 'string',
      nullable: true,
      example: 'classic',
      description: 'Set on the designs that ship with the app (read-only)',
    },
    ...design,
    sortOrder: { type: 'integer' },
    createdAt: { type: 'integer', description: 'Unix timestamp' },
    updatedAt: { type: 'integer', description: 'Unix timestamp' },
  },
}

const named = (description: string) => ({
  type: 'array',
  description,
  items: {
    type: 'object',
    properties: { id: { type: 'integer' }, name: { type: 'string' } },
  },
})

const usage = {
  type: 'object',
  properties: {
    screens: named('Screens drawing with it'),
    sceneScreens: {
      type: 'array',
      description: 'Screens drawing with it while an OBS scene is live',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          obsSceneName: { type: 'string' },
        },
      },
    },
    presentations: {
      type: 'array',
      description: 'Presentations (or their items) drawn with it',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, title: { type: 'string' } },
      },
    },
  },
}

const data = (schema: unknown, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: schema } },
    },
  },
})

const failed = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
})

export const slideTemplatesPaths = {
  '/api/slide-templates': {
    get: {
      tags,
      summary: 'List the slide templates',
      description: "The church's own templates first, then the bundled ones.",
      security,
      responses: {
        '200': data({ type: 'array', items: template }, 'The templates'),
        ...errors,
      },
    },
    post: {
      tags,
      summary: 'Create a slide template',
      description:
        'A copy of `fromId` (bundled or not) when given, else the classic design under the name.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Evening verses' },
                fromId: { type: 'integer' },
              },
            },
          },
        },
      },
      responses: {
        '201': data(template, 'The new template'),
        '400': failed('No name'),
        '404': failed('No template `fromId`'),
        ...errors,
      },
    },
  },
  '/api/slide-templates/{id}': {
    get: {
      tags,
      summary: 'Get a slide template',
      description: 'With who draws with it.',
      security,
      parameters: [idParam],
      responses: {
        '200': data(
          { allOf: [template, { type: 'object', properties: { usage } }] },
          'The template',
        ),
        '404': failed('No such template'),
        ...errors,
      },
    },
    put: {
      tags,
      summary: 'Save a slide template',
      description:
        'Saves the parts given. Every screen drawing with it redraws. A bundled template answers 409: duplicate it to change it.',
      security,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { name: { type: 'string' }, ...design },
            },
          },
        },
      },
      responses: {
        '200': data(template, 'The saved template'),
        '400': failed('An empty name'),
        '404': failed('No such template'),
        '409': failed('A bundled template'),
        ...errors,
      },
    },
    delete: {
      tags,
      summary: 'Delete a slide template',
      description:
        'Only one of the church’s own that no screen, OBS scene or presentation draws with (409 otherwise).',
      security,
      parameters: [idParam],
      responses: {
        '200': data(
          { type: 'object', properties: { success: { type: 'boolean' } } },
          'Deleted',
        ),
        '404': failed('No such template'),
        '409': failed('Bundled, or still in use'),
        ...errors,
      },
    },
  },
  '/api/screens/{id}/scene-templates/{sceneName}': {
    put: {
      tags,
      summary: "Set a screen's template for an OBS scene",
      description:
        'While the OBS scene is live, the screen draws with this template; `null` gives it back its own.',
      security,
      parameters: [
        idParam,
        {
          name: 'sceneName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The OBS scene name, URL-encoded',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                templateId: { type: 'integer', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        '200': data(
          { type: 'object', properties: { success: { type: 'boolean' } } },
          'Set',
        ),
        '400': failed('No such template'),
        ...errors,
      },
    },
  },
}
