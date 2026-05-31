import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createUser,
  deleteUser,
  getAllRoles,
  getAllUsers,
  getCurrentUser,
  getExternalInterfaces,
  getUserAuthUrl,
  getUserAuthUrlForIp,
  getUserById,
  regenerateUserToken,
  setUserRole,
  updateUser,
  updateUserPermissions,
} from '../users'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))
vi.mock('../../../../utils/fetcher', () => ({
  fetcher: vi.fn(),
}))
vi.mock('~/config', () => ({
  getApiUrl: vi.fn(() => 'http://localhost:3000'),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('users/service/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllUsers', () => {
    it('returns all users', async () => {
      const users = [{ id: 1, name: 'Admin' }]
      mockFetcher.mockResolvedValue({ data: users })
      const result = await getAllUsers()
      expect(mockFetcher).toHaveBeenCalledWith('/api/users')
      expect(result).toEqual(users)
    })
  })

  describe('getUserById', () => {
    it('returns user by id', async () => {
      const user = { id: 1, name: 'Admin' }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await getUserById(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users/1')
      expect(result).toEqual(user)
    })

    it('returns null when fetcher throws', async () => {
      mockFetcher.mockRejectedValue(new Error('Not found'))
      const result = await getUserById(999)
      expect(result).toBeNull()
    })
  })

  describe('createUser', () => {
    it('creates a user', async () => {
      const result = { id: 1, name: 'New', token: 'abc' }
      mockFetcher.mockResolvedValue({ data: result })
      const created = await createUser({ name: 'New' } as any)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New' }),
      })
      expect(created).toEqual(result)
    })
  })

  describe('updateUser', () => {
    it('updates a user', async () => {
      const user = { id: 1, name: 'Updated' }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await updateUser(1, { name: 'Updated' } as any)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      })
      expect(result).toEqual(user)
    })
  })

  describe('deleteUser', () => {
    it('deletes a user', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await deleteUser(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users/1', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })
  })

  describe('updateUserPermissions', () => {
    it('updates permissions', async () => {
      const user = { id: 1, permissions: ['songs.manage'] }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await updateUserPermissions(1, ['songs.manage'] as any)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users/1/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: ['songs.manage'] }),
      })
      expect(result).toEqual(user)
    })
  })

  describe('setUserRole', () => {
    it('sets role', async () => {
      const user = { id: 1, roleId: 2 }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await setUserRole(1, 2)
      expect(mockFetcher).toHaveBeenCalledWith('/api/users/1/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: 2 }),
      })
      expect(result).toEqual(user)
    })

    it('sets role to null', async () => {
      const user = { id: 1, roleId: null }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await setUserRole(1, null)
      expect(result).toEqual(user)
    })
  })

  describe('regenerateUserToken', () => {
    it('regenerates token', async () => {
      const result = { id: 1, token: 'new-token' }
      mockFetcher.mockResolvedValue({ data: result })
      const res = await regenerateUserToken(1)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/users/1/regenerate-token',
        { method: 'POST' },
      )
      expect(res).toEqual(result)
    })
  })

  describe('getAllRoles', () => {
    it('returns all roles', async () => {
      const roles = [{ id: 1, name: 'Admin' }]
      mockFetcher.mockResolvedValue({ data: roles })
      const result = await getAllRoles()
      expect(mockFetcher).toHaveBeenCalledWith('/api/roles')
      expect(result).toEqual(roles)
    })
  })

  describe('getCurrentUser', () => {
    it('returns current user', async () => {
      const user = { id: 1, name: 'Me' }
      mockFetcher.mockResolvedValue({ data: user })
      const result = await getCurrentUser()
      expect(mockFetcher).toHaveBeenCalledWith('/api/auth/me')
      expect(result).toEqual(user)
    })

    it('propagates when the fetcher throws (callers detect connection errors)', async () => {
      // getCurrentUser intentionally does NOT swallow errors. /api/auth/me
      // returns 200 {data:null} when signed out, so a thrown error means the
      // server is unreachable. PermissionsProvider relies on the throw to show
      // a connection error instead of a false "signed out" state.
      mockFetcher.mockRejectedValue(new Error('Unauthorized'))
      await expect(getCurrentUser()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getUserAuthUrl', () => {
    it('generates auth URL', () => {
      const url = getUserAuthUrl('my-token')
      expect(url).toBe('http://localhost:3000/api/auth/user/my-token')
    })

    it('encodes special characters in token', () => {
      const url = getUserAuthUrl('token/with spaces')
      expect(url).toBe(
        'http://localhost:3000/api/auth/user/token%2Fwith%20spaces',
      )
    })
  })

  describe('getUserAuthUrlForIp', () => {
    it('generates auth URL for a specific IP', () => {
      const url = getUserAuthUrlForIp('my-token', '192.168.1.100')
      expect(url).toContain('192.168.1.100')
      expect(url).toContain('/api/auth/user/my-token')
    })
  })

  describe('getExternalInterfaces', () => {
    it('returns network interfaces', async () => {
      const interfaces = [
        { name: 'en0', address: '192.168.1.100', family: 'IPv4' },
      ]
      mockFetcher.mockResolvedValue({ data: interfaces })
      const result = await getExternalInterfaces()
      expect(mockFetcher).toHaveBeenCalledWith('/api/network/interfaces')
      expect(result).toEqual(interfaces)
    })
  })
})
