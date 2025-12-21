export const devicesPaths = {
  '/api/devices': {
    get: {
      tags: ['Devices'],
      summary: 'List all devices',
      description:
        'Returns all registered devices with their permissions. Admin only.',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of devices',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/DeviceWithPermissions',
                    },
                  },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
    post: {
      tags: ['Devices'],
      summary: 'Create a new device',
      description:
        'Creates a new device with specified permissions. Returns the device and its authentication token (token only shown once). Admin only.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateDeviceInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Device created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/CreateDeviceResult' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/devices/{id}': {
    get: {
      tags: ['Devices'],
      summary: 'Get device by ID',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Device ID',
        },
      ],
      responses: {
        '200': {
          description: 'Device details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/DeviceWithPermissions',
                  },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Devices'],
      summary: 'Update device',
      description: 'Update device name or active status. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateDeviceInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Device updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/DeviceWithPermissions',
                  },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
    delete: {
      tags: ['Devices'],
      summary: 'Delete device',
      description: 'Delete a device and revoke its access. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Device deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/devices/{id}/permissions': {
    put: {
      tags: ['Devices'],
      summary: 'Update device permissions',
      description: 'Update the permissions for a specific device. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permissions'],
              properties: {
                permissions: {
                  $ref: '#/components/schemas/DevicePermissions',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Permissions updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/DeviceWithPermissions',
                  },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/devices/{id}/regenerate-token': {
    post: {
      tags: ['Devices'],
      summary: 'Regenerate device token',
      description:
        'Generates a new authentication token for the device, invalidating the old one. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Token regenerated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/CreateDeviceResult' },
                },
              },
            },
          },
        },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
}
