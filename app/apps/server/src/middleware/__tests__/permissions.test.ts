import { describe, expect, it } from 'bun:test'
import {
  requireAllPermissions,
  requireAnyPermission,
  requirePermission,
} from '../permissions'
import type { RequestContext } from '../types'

function appContext(): RequestContext {
  return { authType: 'app' }
}

function userContext(permissions: string[]): RequestContext {
  return {
    authType: 'user',
    userId: 1,
    permissions: permissions as any[],
  }
}

function userContextNoPermissions(): RequestContext {
  return {
    authType: 'user',
    userId: 1,
  }
}

describe('requirePermission', () => {
  it('allows app auth to bypass all permission checks', () => {
    const checker = requirePermission('songs.view' as any)
    const result = checker(appContext())
    expect(result).toBeNull()
  })

  it('allows user with the required permission', () => {
    const checker = requirePermission('songs.view' as any)
    const result = checker(userContext(['songs.view', 'songs.create']))
    expect(result).toBeNull()
  })

  it('denies user without the required permission', () => {
    const checker = requirePermission('songs.create' as any)
    const result = checker(userContext(['songs.view']))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('denies user with no permissions configured', () => {
    const checker = requirePermission('songs.view' as any)
    const result = checker(userContextNoPermissions())
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('returns correct error message when permission is missing', async () => {
    const checker = requirePermission('songs.delete' as any)
    const result = checker(userContext(['songs.view']))
    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toContain('songs.delete')
  })

  it('returns correct error for no permissions configured', async () => {
    const checker = requirePermission('songs.view' as any)
    const result = checker(userContextNoPermissions())
    const body = await result!.json()
    expect(body.message).toBe('No permissions configured')
  })
})

describe('requireAllPermissions', () => {
  it('allows app auth to bypass all checks', () => {
    const checker = requireAllPermissions([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(appContext())
    expect(result).toBeNull()
  })

  it('allows user with all required permissions', () => {
    const checker = requireAllPermissions([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(
      userContext(['songs.view', 'songs.create', 'songs.delete']),
    )
    expect(result).toBeNull()
  })

  it('denies user missing one of the required permissions', () => {
    const checker = requireAllPermissions([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['songs.view']))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('denies user missing all required permissions', () => {
    const checker = requireAllPermissions([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['schedules.view']))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('allows empty permissions array', () => {
    const checker = requireAllPermissions([])
    const result = checker(userContext(['songs.view']))
    expect(result).toBeNull()
  })
})

describe('requireAnyPermission', () => {
  it('allows app auth to bypass all checks', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(appContext())
    expect(result).toBeNull()
  })

  it('allows user with at least one of the required permissions', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['songs.view']))
    expect(result).toBeNull()
  })

  it('allows user with all of the required permissions', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['songs.view', 'songs.create']))
    expect(result).toBeNull()
  })

  it('denies user without any of the required permissions', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['schedules.view']))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('denies user with no permissions configured', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContextNoPermissions())
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('returns correct error message for insufficient permissions', async () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext(['schedules.view']))
    const body = await result!.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toBe('Insufficient permissions')
  })

  it('denies user with empty permissions array', () => {
    const checker = requireAnyPermission([
      'songs.view',
      'songs.create',
    ] as any[])
    const result = checker(userContext([]))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })
})
