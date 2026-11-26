/** The title and one-line explanation of a song-sources settings section. */
export function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      <p className="mt-0.5 text-sm text-fg-hint">{description}</p>
    </div>
  )
}
