const userResponse = {
  type: 'object',
  properties: {
    data: { $ref: '#/components/schemas/UserWithPermissions' },
  },
}

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}

export const usersPaths = {
  '/api/users': {
    get: {
      tags: ['Users'],
      summary: 'List all users',
      description: 'Super-admin / system token only.',
      responses: {
        '200': {
          description: 'List of users with permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/UserWithPermissions',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Create a user',
      description: 'Super-admin / system token only.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                roleId: { type: 'integer' },
                permissions: { type: 'array', items: { type: 'string' } },
                password: {
                  type: 'string',
                  description:
                    'Optional login password (omit for passwordless)',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Created user with its plaintext token',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
  },
  '/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get a user by id',
      parameters: [idParam],
      responses: {
        '200': {
          description: 'User',
          content: { 'application/json': { schema: userResponse } },
        },
      },
    },
    put: {
      tags: ['Users'],
      summary: 'Update a user',
      parameters: [idParam],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                isActive: { type: 'boolean' },
                roleId: { type: ['integer', 'null'] },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated user',
          content: { 'application/json': { schema: userResponse } },
        },
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Delete a user',
      description: 'The super-admin account cannot be deleted.',
      parameters: [idParam],
      responses: {
        '200': {
          description: 'Deletion result',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
  },
  '/api/users/{id}/permissions': {
    put: {
      tags: ['Users'],
      summary: "Replace a user's custom permissions",
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permissions'],
              properties: {
                permissions: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated user',
          content: { 'application/json': { schema: userResponse } },
        },
      },
    },
  },
  '/api/users/{id}/password': {
    put: {
      tags: ['Users'],
      summary: "Set or clear a user's login password",
      description: 'Send { "password": null } to remove the password.',
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                password: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated user',
          content: { 'application/json': { schema: userResponse } },
        },
      },
    },
  },
  '/api/users/{id}/role': {
    put: {
      tags: ['Users'],
      summary: "Set a user's role",
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { roleId: { type: ['integer', 'null'] } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated user',
          content: { 'application/json': { schema: userResponse } },
        },
      },
    },
  },
  '/api/users/{id}/regenerate-token': {
    post: {
      tags: ['Users'],
      summary: "Regenerate a user's remote-access token",
      parameters: [idParam],
      responses: {
        '200': {
          description: 'New token',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
  },
}
