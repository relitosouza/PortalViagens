// HIGH PRIORITY FIX: Create safe type for authenticated user
// This prevents unsafe type casting throughout the codebase

export interface AuthUser {
  id: string
  role: 'DEMANDANTE' | 'SECRETARIO' | 'ADMIN' | 'SECOL' | 'SEGOV' | 'SF'
  name?: string | null
  email?: string | null
}

/**
 * Safely extract and validate user from session
 * Never use unsafe `as` casting - use this instead
 */
export function getAuthUser(sessionUser: unknown): AuthUser | null {
  if (!sessionUser || typeof sessionUser !== 'object') {
    return null
  }

  const user = sessionUser as Record<string, unknown>

  // Validate required fields
  if (typeof user.id !== 'string' || !user.id) {
    console.warn('Invalid session: missing or invalid id')
    return null
  }

  if (typeof user.role !== 'string' || !user.role) {
    console.warn('Invalid session: missing or invalid role')
    return null
  }

  const validRoles = ['DEMANDANTE', 'SECRETARIO', 'ADMIN', 'SECOL', 'SEGOV', 'SF']
  if (!validRoles.includes(user.role)) {
    console.warn(`Invalid session: unauthorized role "${user.role}"`)
    return null
  }

  return {
    id: user.id,
    role: user.role as AuthUser['role'],
    name: typeof user.name === 'string' ? user.name : null,
    email: typeof user.email === 'string' ? user.email : null,
  }
}

/**
 * Require admin role and return validated user
 */
export function requireAdmin(user: AuthUser | null): boolean {
  return user?.role === 'ADMIN'
}

/**
 * Check if user can access resource they created/own
 */
export function isResourceOwner(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId
}
