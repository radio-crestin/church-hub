export const deviceSchemas = {
  FeaturePermissions: {
    type: 'object',
    properties: {
      read: { type: 'boolean' },
      write: { type: 'boolean' },
      delete: { type: 'boolean' },
    },
  },
  DevicePermissions: {
    type: 'object',
    properties: {
      songs: { $ref: '#/components/schemas/FeaturePermissions' },
      schedules: { $ref: '#/components/schemas/FeaturePermissions' },
      presentation: { $ref: '#/components/schemas/FeaturePermissions' },
      settings: { $ref: '#/components/schemas/FeaturePermissions' },
    },
  },
  DeviceWithPermissions: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      isActive: { type: 'boolean' },
      lastUsedAt: { type: 'integer', nullable: true },
      createdAt: { type: 'integer' },
      updatedAt: { type: 'integer' },
      permissions: { $ref: '#/components/schemas/DevicePermissions' },
    },
  },
  CreateDeviceInput: {
    type: 'object',
    required: ['name', 'permissions'],
    properties: {
      name: { type: 'string', example: 'Living Room TV' },
      permissions: { $ref: '#/components/schemas/DevicePermissions' },
    },
  },
  UpdateDeviceInput: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      isActive: { type: 'boolean' },
    },
  },
  CreateDeviceResult: {
    type: 'object',
    properties: {
      device: { $ref: '#/components/schemas/DeviceWithPermissions' },
      token: {
        type: 'string',
        description: 'Device authentication token (only shown once)',
      },
    },
  },
}
