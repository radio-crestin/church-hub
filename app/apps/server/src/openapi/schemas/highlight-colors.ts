export const highlightColorSchemas = {
  HighlightColor: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      color: { type: 'string', description: 'Hex color code (e.g., #FF5733)' },
      textColor: {
        type: 'string',
        description: 'Text color for contrast (e.g., #000000)',
      },
      sortOrder: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  UpsertHighlightColorInput: {
    type: 'object',
    required: ['name', 'color'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing color',
      },
      name: { type: 'string', example: 'Yellow Highlight' },
      color: { type: 'string', example: '#FFFF00' },
      textColor: {
        type: 'string',
        example: '#000000',
        description: 'Text color for contrast',
      },
      sortOrder: { type: 'integer', description: 'Sort order position' },
    },
  },
  ReorderHighlightColorsInput: {
    type: 'object',
    required: ['colorIds'],
    properties: {
      colorIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Array of color IDs in the desired order',
      },
    },
  },
}
