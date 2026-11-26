interface PolicyParagraphProps {
  title: string
  text: string
}

/** One titled paragraph of the privacy policy. */
export function PolicyParagraph({ title, text }: PolicyParagraphProps) {
  return (
    <div>
      <h4 className="text-[13px] font-medium text-fg">{title}</h4>
      <p className="mt-1 text-[13px] text-fg-body">{text}</p>
    </div>
  )
}
