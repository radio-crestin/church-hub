import { X } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  duration?: number
  action?: ToastAction
}

interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions) => {
      const id = Date.now()
      setToasts((prev) => [
        ...prev,
        { id, message, type, action: options?.action },
      ])

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, options?.duration ?? 3000)
    },
    [],
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white'
      case 'error':
        return 'bg-red-600 text-white'
      default:
        return 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${getToastStyles(toast.type)}`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  dismissToast(toast.id)
                }}
                className="px-2 py-0.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  )
}
