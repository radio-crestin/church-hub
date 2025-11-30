import { openApiSpec } from './spec'

/**
 * Returns the OpenAPI specification as JSON
 */
export function getOpenApiSpec(): Response {
  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Returns the Scalar documentation HTML page
 */
export function getScalarDocs(): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Church Hub API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/api/openapi.json"
    data-configuration='${JSON.stringify({
      theme: 'purple',
      hideModels: false,
      hideDownloadButton: false,
      showSidebar: true,
      searchHotKey: 'k',
    })}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

export { openApiSpec }
