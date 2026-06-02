export const userSchemas = {
  CurrentUser: {
    type: 'object',
    description: 'The currently authenticated user and their effective permissions',
    properties: {
      id: { type: 'integer', description: '0 for system-token sessions' },
      name: { type: 'string' },
      isApp: {
        type: 'boolean',
        description: 'True for super-admin / system sessions (full access)',
      },
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  UserWithPermissions: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      token: { type: 'string' },
      isActive: { type: 'boolean' },
      isSuperAdmin: { type: 'boolean' },
      hasPassword: {
        type: 'boolean',
        description: 'Whether a login password is set (hash never exposed)',
      },
      roleId: { type: ['integer', 'null'] },
      roleName: { type: ['string', 'null'] },
      lastUsedAt: { type: ['integer', 'null'] },
      createdAt: { type: 'integer' },
      updatedAt: { type: 'integer' },
      permissions: { type: 'array', items: { type: 'string' } },
    },
  },
}
