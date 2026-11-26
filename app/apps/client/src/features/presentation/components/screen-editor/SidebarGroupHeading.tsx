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
    <div className="px-4 pt-4 pb-2 border-b border-line">
      <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-hint">{description}</p>
    </div>
  )
}
