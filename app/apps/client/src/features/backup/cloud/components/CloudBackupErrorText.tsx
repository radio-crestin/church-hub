import { AlertTriangle } from 'lucide-react'

/** A cloud backup problem: an icon and the sentence, in grey (red is the projector's). */
export function CloudBackupErrorText({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-fg" role="alert">
      <AlertTriangle
        strokeWidth={2}
        className="mt-0.5 h-3 w-3 shrink-0 text-fg-label"
      />
      {children}
    </p>
  )
}
