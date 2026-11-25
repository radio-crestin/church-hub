import { type Context, Hono } from 'hono'
import { acceptTransfer } from '../sync/owner/acceptTransfer'
import { listOwnedChurches } from '../sync/owner/listOwnedChurches'
import { finishOwnerSignIn, startOwnerSignIn } from '../sync/owner/ownerSignIn'
import { ticketFromHeader, verifyOwnerTicket } from '../sync/owner/ownerTicket'
import { replaceServer } from '../sync/owner/replaceServer'
import { transferOwnership } from '../sync/owner/transferOwnership'
import { handleSyncError } from '../sync/handleSyncError'
import { readInstallation } from '../sync/readInstallation'
import { readJsonBody } from '../sync/readJsonBody'
import { createSyncStore } from '../sync/state/createSyncStore'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'

type OwnerContext = Context<{ Bindings: Bindings }>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The owner's side of cloud sync (T-172): Google sign-in, which hands the
 * church PC a signed one-hour owner ticket, and what only the owner can do
 * with it (`Authorization: Bearer cho_…`).
 */
const syncOwner = new Hono<{ Bindings: Bindings }>()

syncOwner.onError(handleSyncError)

/** The signed-in account, from the ticket in the Authorization header. */
async function signedIn(c: OwnerContext) {
  const store = createSyncStore(c.env)
  const owner = await verifyOwnerTicket(
    ticketFromHeader(c.req.header('Authorization')),
    store.secret
  )
  return { store, owner }
}

/** The PC the owner acts from (its installation id and name are required). */
function requireInstallation(c: OwnerContext) {
  const installation = readInstallation((name) => c.req.header(name))
  if (!installation) {
    throw new SyncError(
      400,
      'invalid_request',
      'X-Church-Hub-Installation is required'
    )
  }
  return installation
}

/** GET /sync/owner/sign-in?returnUrl&nonce: to Google's account chooser. */
syncOwner.get('/sync/owner/sign-in', async (c) =>
  c.redirect(
    await startOwnerSignIn(
      c.env,
      c.req.url,
      c.req.query('returnUrl'),
      c.req.query('nonce')
    )
  )
)

/** GET /sync/owner/callback: Google's answer, back to the PC with a ticket. */
syncOwner.get('/sync/owner/callback', async (c) =>
  c.redirect(
    await finishOwnerSignIn(c.env, c.req.url, {
      code: c.req.query('code'),
      state: c.req.query('state'),
      error: c.req.query('error'),
    })
  )
)

/** GET /sync/owner/churches: the church servers this account owns or is offered. */
syncOwner.get('/sync/owner/churches', async (c) => {
  const { store, owner } = await signedIn(c)
  return c.json({
    email: owner.email,
    churches: await listOwnedChurches(store, owner),
  })
})

/** POST /sync/owner/churches/:churchId/recover: this PC becomes its server. */
syncOwner.post('/sync/owner/churches/:churchId/recover', async (c) => {
  const { store, owner } = await signedIn(c)
  const credentials = await replaceServer(
    store,
    c.req.param('churchId'),
    owner,
    requireInstallation(c),
    false
  )
  return c.json(credentials)
})

/**
 * POST /sync/owner/churches/:churchId/reset: revoke every device (the
 * server's old token too), issue this PC a fresh one and rotate the path.
 */
syncOwner.post('/sync/owner/churches/:churchId/reset', async (c) => {
  const { store, owner } = await signedIn(c)
  const credentials = await replaceServer(
    store,
    c.req.param('churchId'),
    owner,
    requireInstallation(c),
    true
  )
  return c.json(credentials)
})

/** POST /sync/owner/churches/:churchId/transfer { email }: offer it to another account. */
syncOwner.post('/sync/owner/churches/:churchId/transfer', async (c) => {
  const body = (await readJsonBody(c)) as { email?: unknown }
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL.test(email) || email.length > 320) {
    throw new SyncError(400, 'invalid_request', 'A valid email is required')
  }
  const { store, owner } = await signedIn(c)
  return c.json(
    await transferOwnership(store, c.req.param('churchId'), owner, email)
  )
})

/** POST /sync/owner/churches/:churchId/accept: take a church offered to you. */
syncOwner.post('/sync/owner/churches/:churchId/accept', async (c) => {
  const { store, owner } = await signedIn(c)
  return c.json(await acceptTransfer(store, c.req.param('churchId'), owner))
})

export default syncOwner
