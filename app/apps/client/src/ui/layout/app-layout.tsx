import { useLocation } from '@tanstack/react-router'

import { Sidebar } from '../sidebar/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()

  // Full-screen mode for display windows
  if (location.pathname.startsWith('/display/')) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 pt-14 md:pt-0">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
