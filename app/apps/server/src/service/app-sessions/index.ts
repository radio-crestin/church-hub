import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { appSessions } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { hashToken } from '../users/users'

const SYSTEM_TOKEN_NAME = 'System API Token'
const logger = createLogger('app-sessions')

export function generateSystemToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `sys_${base64}`
}

export async function getOrCreateSystemToken(): Promise<{
  token: string | null
  isNew: boolean
}> {
  const db = getDatabase()

  const existing = db
    .select()
    .from(appSessions)
    .where(eq(appSessions.name, SYSTEM_TOKEN_NAME))
    .get()

  if (existing) {
    logger.debug('System token already exists')
    return { token: null, isNew: false }
  }

  const token = generateSystemToken()
  const tokenHash = await hashToken(token)

  db.insert(appSessions)
    .values({
      sessionToken: token,
      sessionTokenHash: tokenHash,
      name: SYSTEM_TOKEN_NAME,
    })
    .run()

  logger.info('System token created successfully')
  return { token, isNew: true }
}

export function getSystemToken(): {
  token: string
  lastUsedAt: Date | null
  createdAt: Date
} | null {
  const db = getDatabase()

  const session = db
    .select()
    .from(appSessions)
    .where(eq(appSessions.name, SYSTEM_TOKEN_NAME))
    .get()

  if (!session) {
    return null
  }

  return {
    token: session.sessionToken,
    lastUsedAt: session.lastUsedAt,
    createdAt: session.createdAt,
  }
}

export async function regenerateSystemToken(): Promise<string> {
  const db = getDatabase()

  const token = generateSystemToken()
  const tokenHash = await hashToken(token)

  const existing = db
    .select()
    .from(appSessions)
    .where(eq(appSessions.name, SYSTEM_TOKEN_NAME))
    .get()

  if (existing) {
    db.update(appSessions)
      .set({
        sessionToken: token,
        sessionTokenHash: tokenHash,
        lastUsedAt: null,
      })
      .where(eq(appSessions.id, existing.id))
      .run()
    logger.info('System token regenerated')
  } else {
    db.insert(appSessions)
      .values({
        sessionToken: token,
        sessionTokenHash: tokenHash,
        name: SYSTEM_TOKEN_NAME,
      })
      .run()
    logger.info('System token created')
  }

  return token
}

export async function validateSystemToken(token: string): Promise<boolean> {
  try {
    const db = getDatabase()
    const tokenHash = await hashToken(token)

    const session = db
      .select()
      .from(appSessions)
      .where(eq(appSessions.sessionTokenHash, tokenHash))
      .get()

    if (session) {
      db.update(appSessions)
        .set({ lastUsedAt: new Date() })
        .where(eq(appSessions.id, session.id))
        .run()

      logger.debug(`System token validated: ${session.name}`)
      return true
    }

    return false
  } catch (error) {
    logger.error(`Failed to validate system token: ${error}`)
    return false
  }
}
