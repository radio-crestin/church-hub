import { X } from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'

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
  // A counter, not Date.now(): toasts raised in the same millisecond (one per
  // file of a multi-file upload) must not share a key or expire together.
  const nextIdRef = useRef(0)

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions) => {
      nextIdRef.current += 1
      const id = nextIdRef.current
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
      case 'error':
        return 'bg-red-600 text-white'
      default:
        return 'bg-panel text-fg border border-line'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-3.5 py-2.5 rounded-[10px] shadow-popover flex items-center gap-3 text-sm animate-slide-in ${getToastStyles(toast.type)}`}
          >
            {toast.type === 'success' && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-ok" />
            )}
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  dismissToast(toast.id)
                }}
                className="px-2 py-0.5 text-xs font-medium bg-current/10 hover:bg-current/20 rounded-md transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X strokeWidth={1.5} className="w-4 h-4" />
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
