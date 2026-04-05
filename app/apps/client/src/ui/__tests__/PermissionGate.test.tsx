import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import {
  PermissionGate,
  useHasAnyPermission,
  useHasPermission,
} from '../PermissionGate'

// Mock the permissions provider
const mockUsePermissions = vi.fn()
vi.mock('../../provider/permissions-provider', () => ({
  usePermissions: () => mockUsePermissions(),
}))

function createPermissionsValue(overrides = {}) {
  return {
    permissions: [],
    hasPermission: vi.fn(() => false),
    hasAnyPermission: vi.fn(() => false),
    hasAllPermissions: vi.fn(() => false),
    isAdmin: false,
    isApp: false,
    isAuthenticated: true,
    isLoading: false,
    isConnectionError: false,
    userId: 1,
    userName: 'Test User',
    refresh: vi.fn(),
    ...overrides,
  }
}

describe('PermissionGate', () => {
  test('renders children when single permission is granted', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasPermission: vi.fn(() => true),
      }),
    )

    render(
      <PermissionGate permission="songs.create">
        <div>Protected content</div>
      </PermissionGate>,
    )

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  test('does not render children when single permission is denied', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasPermission: vi.fn(() => false),
      }),
    )

    render(
      <PermissionGate permission="songs.create">
        <div>Protected content</div>
      </PermissionGate>,
    )

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  test('renders fallback when permission is denied', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasPermission: vi.fn(() => false),
      }),
    )

    render(
      <PermissionGate permission="songs.create" fallback={<div>No access</div>}>
        <div>Protected content</div>
      </PermissionGate>,
    )

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('No access')).toBeInTheDocument()
  })

  test('renders children when anyOf permissions match', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAnyPermission: vi.fn(() => true),
      }),
    )

    render(
      <PermissionGate anyOf={['songs.edit', 'songs.delete']}>
        <div>Edit or delete</div>
      </PermissionGate>,
    )

    expect(screen.getByText('Edit or delete')).toBeInTheDocument()
  })

  test('does not render children when no anyOf permissions match', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAnyPermission: vi.fn(() => false),
      }),
    )

    render(
      <PermissionGate anyOf={['songs.edit', 'songs.delete']}>
        <div>Edit or delete</div>
      </PermissionGate>,
    )

    expect(screen.queryByText('Edit or delete')).not.toBeInTheDocument()
  })

  test('renders children when allOf permissions match', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAllPermissions: vi.fn(() => true),
      }),
    )

    render(
      <PermissionGate allOf={['queue.add', 'queue.remove']}>
        <div>Queue management</div>
      </PermissionGate>,
    )

    expect(screen.getByText('Queue management')).toBeInTheDocument()
  })

  test('does not render children when not all allOf permissions match', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAllPermissions: vi.fn(() => false),
      }),
    )

    render(
      <PermissionGate allOf={['queue.add', 'queue.remove']}>
        <div>Queue management</div>
      </PermissionGate>,
    )

    expect(screen.queryByText('Queue management')).not.toBeInTheDocument()
  })

  test('renders nothing while loading', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        isLoading: true,
        hasPermission: vi.fn(() => true),
      }),
    )

    render(
      <PermissionGate permission="songs.view">
        <div>Content</div>
      </PermissionGate>,
    )

    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  test('renders children when no permission props are provided', () => {
    mockUsePermissions.mockReturnValue(createPermissionsValue())

    render(
      <PermissionGate>
        <div>Always visible</div>
      </PermissionGate>,
    )

    expect(screen.getByText('Always visible')).toBeInTheDocument()
  })

  test('calls hasPermission with correct permission string', () => {
    const hasPermission = vi.fn(() => true)
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({ hasPermission }),
    )

    render(
      <PermissionGate permission="songs.edit">
        <div>Edit</div>
      </PermissionGate>,
    )

    expect(hasPermission).toHaveBeenCalledWith('songs.edit')
  })

  test('calls hasAnyPermission with correct permissions array', () => {
    const hasAnyPermission = vi.fn(() => true)
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({ hasAnyPermission }),
    )

    render(
      <PermissionGate anyOf={['songs.edit', 'songs.delete']}>
        <div>Content</div>
      </PermissionGate>,
    )

    expect(hasAnyPermission).toHaveBeenCalledWith([
      'songs.edit',
      'songs.delete',
    ])
  })

  test('calls hasAllPermissions with correct permissions array', () => {
    const hasAllPermissions = vi.fn(() => true)
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({ hasAllPermissions }),
    )

    render(
      <PermissionGate allOf={['queue.add', 'queue.remove']}>
        <div>Content</div>
      </PermissionGate>,
    )

    expect(hasAllPermissions).toHaveBeenCalledWith([
      'queue.add',
      'queue.remove',
    ])
  })
})

describe('useHasPermission', () => {
  function TestHasPermission({ permission }: { permission: string }) {
    const hasAccess = useHasPermission(permission as any)
    return <div>{hasAccess ? 'Has access' : 'No access'}</div>
  }

  test('returns true when permission is granted', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasPermission: vi.fn(() => true),
      }),
    )

    render(<TestHasPermission permission="songs.view" />)
    expect(screen.getByText('Has access')).toBeInTheDocument()
  })

  test('returns false when permission is denied', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasPermission: vi.fn(() => false),
      }),
    )

    render(<TestHasPermission permission="songs.delete" />)
    expect(screen.getByText('No access')).toBeInTheDocument()
  })

  test('returns false while loading', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        isLoading: true,
        hasPermission: vi.fn(() => true),
      }),
    )

    render(<TestHasPermission permission="songs.view" />)
    expect(screen.getByText('No access')).toBeInTheDocument()
  })
})

describe('useHasAnyPermission', () => {
  function TestHasAnyPermission({ permissions }: { permissions: string[] }) {
    const hasAccess = useHasAnyPermission(permissions as any[])
    return <div>{hasAccess ? 'Has access' : 'No access'}</div>
  }

  test('returns true when any permission is granted', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAnyPermission: vi.fn(() => true),
      }),
    )

    render(
      <TestHasAnyPermission permissions={['songs.edit', 'songs.delete']} />,
    )
    expect(screen.getByText('Has access')).toBeInTheDocument()
  })

  test('returns false when no permission is granted', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        hasAnyPermission: vi.fn(() => false),
      }),
    )

    render(
      <TestHasAnyPermission permissions={['songs.edit', 'songs.delete']} />,
    )
    expect(screen.getByText('No access')).toBeInTheDocument()
  })

  test('returns false while loading', () => {
    mockUsePermissions.mockReturnValue(
      createPermissionsValue({
        isLoading: true,
        hasAnyPermission: vi.fn(() => true),
      }),
    )

    render(<TestHasAnyPermission permissions={['songs.edit']} />)
    expect(screen.getByText('No access')).toBeInTheDocument()
  })
})
