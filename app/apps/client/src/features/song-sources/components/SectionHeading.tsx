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
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h4>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  )
}
