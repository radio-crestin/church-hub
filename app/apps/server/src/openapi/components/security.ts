export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT token for Tauri app authentication',
  },
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'device_auth',
    description: 'Cookie-based authentication for external devices',
  },
}
