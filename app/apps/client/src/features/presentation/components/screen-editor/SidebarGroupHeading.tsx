interface SidebarGroupHeadingProps {
  title: string
  description: string
}

/** Names a group of the sidebar's sections and says what they apply to. */
export function SidebarGroupHeading({
  title,
  description,
}: SidebarGroupHeadingProps) {
  return (
    <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  )
}
