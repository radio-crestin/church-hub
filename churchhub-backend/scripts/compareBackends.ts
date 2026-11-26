/**
 * Compatibility check between two deployments of this backend (e.g. the one
 * released apps call today and a new one meant to replace it): the calls the
 * released desktop app and listener page make, sent to both, compared by
 * status, CORS and security headers, content type, redirect shape and JSON
 * shape (keys and value types, not values). The host of each deployment is
 * normalised away. Safe to run against production: it only reads, gets
 * validation errors, or opens and closes a throwaway signaling room. Costs
 * one of each IP's per-minute feature-request calls.
 *
 *   bun scripts/compareBackends.ts <reference base URL> <candidate base URL>
 *
 * Prints every difference; exits 1 when there is one.
 */
const [referenceBase, candidateBase] = process.argv.slice(2)
if (!referenceBase || !candidateBase) {
  console.error('usage: bun scripts/compareBackends.ts <reference URL> <candidate URL>')
  process.exit(2)
}

const APP_ORIGIN = 'http://localhost:3000'
const COMPARED_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-max-age',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'strict-transport-security',
]

/** What one deployment answered earlier in the run (the signaling session). */
interface Context {
  sessionId?: string
}

interface Call {
  name: string
  method?: string
  path: string | ((context: Context) => string)
  headers?: Record<string, string>
  body?: unknown | ((context: Context) => unknown)
  /** Keeps a value of this answer for later calls to the same deployment. */
  capture?: (body: Record<string, unknown>, context: Context) => void
}

const secret = `compat${crypto.randomUUID().replace(/-/g, '')}`
const json = { 'Content-Type': 'application/json', Origin: APP_ORIGIN }

const CALLS: Call[] = [
  { name: 'health', path: '/health' },
  { name: 'unknown route', path: '/no-such-route' },
  {
    name: 'CORS preflight (token refresh)',
    method: 'OPTIONS',
    path: '/auth/youtube/refresh',
    headers: {
      Origin: APP_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  },
  { name: 'YouTube sign-in start', path: `/auth/youtube?origin=${encodeURIComponent(APP_ORIGIN)}` },
  { name: 'Drive sign-in start', path: `/auth/drive?origin=${encodeURIComponent(APP_ORIGIN)}` },
  { name: 'sign-in from a foreign origin', path: '/auth/youtube?origin=https%3A%2F%2Fevil.example' },
  { name: 'YouTube callback without state', path: '/auth/youtube/callback?code=x' },
  { name: 'YouTube refresh, no token', method: 'POST', path: '/auth/youtube/refresh', headers: json, body: {} },
  { name: 'Drive refresh, no token', method: 'POST', path: '/auth/drive/refresh', headers: json, body: {} },
  { name: 'feature request, invalid', method: 'POST', path: '/feature-requests', headers: json, body: {} },
  { name: 'screenshot, unknown id', path: `/feature-requests/screenshots/${crypto.randomUUID()}.png` },
  { name: 'signal register', method: 'POST', path: '/signal/register', headers: json, body: { secret } },
  { name: 'signal check', path: `/signal/${secret}/check`, headers: { Origin: APP_ORIGIN } },
  {
    name: 'signal offer (listener)',
    method: 'POST',
    path: `/signal/${secret}/offer`,
    headers: json,
    body: { offer: 'v=0' },
    capture: (body, context) => (context.sessionId = String(body.sessionId)),
  },
  { name: 'signal offers (app)', path: `/signal/${secret}/offers`, headers: { Origin: APP_ORIGIN } },
  {
    name: 'signal answer (app)',
    method: 'POST',
    path: `/signal/${secret}/answer`,
    headers: json,
    body: (context: Context) => ({ sessionId: context.sessionId, answer: 'v=0' }),
  },
  {
    name: 'signal answer (listener)',
    path: (context) => `/signal/${secret}/answer/${context.sessionId}`,
  },
  { name: 'signal unregister', method: 'POST', path: '/signal/unregister', headers: json, body: { secret } },
  { name: 'signal, invalid secret', path: '/signal/x/offers' },
  { name: 'listener page', path: `/listen/${secret}` },
  { name: 'sync API description', path: '/sync/openapi.json' },
  { name: 'sync register, empty', method: 'POST', path: '/sync/churches', headers: json, body: {} },
]

interface Observed {
  status: number
  headers: Record<string, string>
  location?: string
  shape: unknown
}

/** A value's shape: its type, and for objects and arrays their members' shapes. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : []
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, shapeOf((value as Record<string, unknown>)[key])])
    )
  }
  return value === null ? 'null' : typeof value
}

/** A redirect's target without its per-request values, the host normalised. */
function redirectShape(location: string, base: string): string {
  const url = new URL(location, base)
  const params = [...url.searchParams.keys()].sort().map((key) => {
    const value = url.searchParams.get(key) ?? ''
    return key.endsWith('redirect_uri') ? `${key}=${normalise(value, base)}` : key
  })
  return `${normalise(`${url.origin}${url.pathname}`, base)}?${params.join('&')}`
}

function normalise(text: string, base: string): string {
  return text.split(new URL(base).origin).join('<backend>')
}

async function observe(base: string, call: Call, context: Context): Promise<Observed> {
  const path = typeof call.path === 'function' ? call.path(context) : call.path
  const body = typeof call.body === 'function' ? call.body(context) : call.body
  const response = await fetch(new URL(path, base), {
    method: call.method ?? 'GET',
    headers: call.headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
  const headers = Object.fromEntries(
    COMPARED_HEADERS.map((name) => [name, response.headers.get(name) ?? '-'])
  )
  headers['content-type'] = (response.headers.get('content-type') ?? '-').split(';')[0]
  const location = response.headers.get('location')
  const text = await response.text()
  let shape: unknown = text ? `text(${headers['content-type']})` : 'empty'
  try {
    const parsed = JSON.parse(text)
    shape = shapeOf(parsed)
    call.capture?.(parsed, context)
  } catch {}
  return {
    status: response.status,
    headers,
    location: location ? redirectShape(location, base) : undefined,
    shape,
  }
}

function differences(reference: Observed, candidate: Observed): string[] {
  const found: string[] = []
  if (reference.status !== candidate.status) found.push(`status ${reference.status} vs ${candidate.status}`)
  for (const [name, value] of Object.entries(reference.headers)) {
    if (value !== candidate.headers[name]) found.push(`${name}: ${value} vs ${candidate.headers[name]}`)
  }
  if (reference.location !== candidate.location) {
    found.push(`redirect: ${reference.location} vs ${candidate.location}`)
  }
  const [a, b] = [JSON.stringify(reference.shape), JSON.stringify(candidate.shape)]
  if (a !== b) found.push(`body shape: ${a} vs ${b}`)
  return found
}

const contexts = { reference: {} as Context, candidate: {} as Context }
let failed = false
for (const call of CALLS) {
  const [reference, candidate] = await Promise.all([
    observe(referenceBase, call, contexts.reference),
    observe(candidateBase, call, contexts.candidate),
  ])
  const found = differences(reference, candidate)
  failed ||= found.length > 0
  console.log(`${found.length ? 'DIFF' : 'same'}  ${call.method ?? 'GET'} ${call.name} (${reference.status})`)
  for (const line of found) console.log(`        ${line}`)
}
process.exit(failed ? 1 : 0)
