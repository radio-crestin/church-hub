interface PolicyParagraphProps {
  title: string
  text: string
}

/** One titled paragraph of the privacy policy. */
export function PolicyParagraph({ title, text }: PolicyParagraphProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-fg">{title}</h4>
      <p className="mt-1 text-sm text-fg-body">{text}</p>
    </div>
  )
}
