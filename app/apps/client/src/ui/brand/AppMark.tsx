interface AppMarkProps {
  size?: number
  className?: string
}

/** The Church Hub mark: a white open book on the primary blue (DESIGN.md, Logo). */
export function AppMark({ size = 24, className = '' }: AppMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`flex-shrink-0 ${className}`}
    >
      <rect width="24" height="24" rx="6" fill="var(--color-primary)" />
      <path
        d="M11.4 7.4C9.9 6.3 7.9 5.8 5.4 5.9v9.9c2.4-.1 4.4.4 6 1.4z"
        fill="white"
      />
      <path
        d="M12.6 7.4c1.5-1.1 3.5-1.6 6-1.5v9.9c-2.4-.1-4.4.4-6 1.4z"
        fill="white"
      />
      <path
        d="M3.9 8.2v9.3c3.1-.3 5.9.3 8.1 1.7 2.2-1.4 5-2 8.1-1.7V8.2"
        fill="none"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
