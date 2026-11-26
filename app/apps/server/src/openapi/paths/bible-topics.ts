/**
 * Bible verses by topic: the bundled topical lists (OpenBible.info, CC BY
 * 4.0), stored as references and resolved in any installed translation.
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Bible Topics']

const errors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { description: 'Missing the bible.view permission' },
}

const topicProperties = {
  id: { type: 'integer' },
  key: { type: 'string', example: 'gods-love' },
  titleEn: { type: 'string', example: "God's love" },
  titleRo: { type: 'string', example: 'Dragostea lui Dumnezeu' },
  referenceCount: { type: 'integer', example: 15 },
}

const passage = {
  type: 'object',
  properties: {
    book: { type: 'string', example: 'JHN', description: 'Book code' },
    chapter: { type: 'integer', example: 3 },
    startVerse: { type: 'integer', example: 16 },
    endVerse: { type: 'integer', example: 17 },
    reference: {
      type: 'string',
      example: 'Ioan 3:16-17',
      description: "In the translation's book names",
    },
    verses: {
      type: 'array',
      items: { $ref: '#/components/schemas/BibleVerse' },
    },
    templateId: {
      type: 'integer',
      nullable: true,
      description: "Its own slide template; null: the topic's",
    },
  },
}

export const bibleTopicsPaths = {
  '/api/bible/topics': {
    get: {
      tags,
      summary: 'List the Bible topics',
      description:
        'Every topic with its English and Romanian title, the bundled ones first.',
      security,
      responses: {
        '200': {
          description: 'The topics',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { type: 'object', properties: topicProperties },
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
  '/api/bible/topics/{id}': {
    get: {
      tags,
      summary: 'A topic with its verses',
      description:
        "The topic's passages, best first, with their verses in the translation. A passage the translation lacks is left out.",
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        {
          name: 'translationId',
          in: 'query',
          required: false,
          description: 'The default translation when not given',
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'The topic and its passages',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      ...topicProperties,
                      translationId: { type: 'integer' },
                      passages: { type: 'array', items: passage },
                    },
                  },
                },
              },
            },
          },
        },
        '404': { description: 'No such topic, or no translation installed' },
        ...errors,
      },
    },
  },
  '/api/bible/topics/{id}/passage-template': {
    put: {
      tags,
      summary: "Set a passage's own template",
      description:
        "One of the topic's passages (its reference: book code, chapter, verse range) is drawn with its own slide template, presented by hand or in the topic's slideshow; `null` draws it with the topic's again. Needs bible.present_now.",
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: [
                'book',
                'chapter',
                'startVerse',
                'endVerse',
                'templateId',
              ],
              properties: {
                book: { type: 'string', example: 'JHN' },
                chapter: { type: 'integer', example: 3 },
                startVerse: { type: 'integer', example: 16 },
                endVerse: { type: 'integer', example: 17 },
                templateId: { type: 'integer', nullable: true, example: 12 },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Saved' },
        '400': { description: 'A field is missing or of the wrong type' },
        '403': { description: 'Missing the bible.present_now permission' },
        '404': {
          description:
            'No such topic, or no such shared template (a presentation’s own cannot be used)',
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
}
