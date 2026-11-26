/** An XML part of the file as a document; throws when it is not well-formed. */
export function parseXml(text: string, path: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${path} is not well-formed XML`)
  }
  return doc
}
