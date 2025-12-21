export const commonSchemas = {
  Setting: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      key: { type: 'string' },
      value: { type: 'string' },
      created_at: { type: 'integer', description: 'Unix timestamp' },
      updated_at: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  OperationResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' },
    },
  },
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
    },
  },
}
