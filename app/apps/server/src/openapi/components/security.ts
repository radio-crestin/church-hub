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
  userAuthHeader: {
    type: 'apiKey',
    in: 'header',
    name: 'X-User-Auth',
    description:
      'A session token in a header: a WebRTC tunnel carries no cookies (device sessions, screen links)',
  },
}
