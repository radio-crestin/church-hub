export const songSourceSchemas = {
  SongSource: {
    type: 'object',
    description:
      'A place songs are imported from: a built-in config file shipped with the app',
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
        enum: ['opensong-zip', 'cantaricrestine-api', 'church-hub-bundle'],
      },
      url: { type: 'string', format: 'uri' },
      homepage: { type: 'string', format: 'uri' },
      license: { type: 'string' },
      origin: { type: 'string', enum: ['built-in'] },
    },
  },
}
