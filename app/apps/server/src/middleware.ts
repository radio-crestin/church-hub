// Re-export from new middleware directory
export * from './middleware/index'

// Legacy export for backwards compatibility
import { combinedAuthMiddleware } from './middleware/index'
export const authMiddleware = async (
  req: Request,
): Promise<Response | null> => {
  const result = await combinedAuthMiddleware(req)
  return result.response
}
