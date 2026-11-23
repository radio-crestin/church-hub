interface PolicyParagraphProps {
  title: string
  text: string
}

/** One titled paragraph of the privacy policy. */
export function PolicyParagraph({ title, text }: PolicyParagraphProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h4>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{text}</p>
    </div>
  )
}
