export const conversionPaths = {
  '/api/convert/check-libreoffice': {
    get: {
      tags: ['Conversion'],
      summary: 'Check LibreOffice installation',
      description:
        'Checks if LibreOffice is installed and available for file conversion',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Installation status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      installed: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/convert/ppt-to-pptx': {
    post: {
      tags: ['Conversion'],
      summary: 'Convert PPT to PPTX',
      description:
        'Converts a legacy .ppt file to modern .pptx format using LibreOffice. Requires LibreOffice to be installed on the server.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['data'],
              properties: {
                data: {
                  type: 'string',
                  description: 'Base64-encoded PPT file data',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Conversion successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64-encoded PPTX file data',
                  },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '503': {
          description: 'LibreOffice not installed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  errorCode: {
                    type: 'string',
                    enum: ['LIBREOFFICE_NOT_INSTALLED'],
                  },
                },
              },
            },
          },
        },
        '500': { $ref: '#/components/responses/BadRequest' },
      },
    },
  },
}
