declare module 'ppt-to-text' {
  interface ReadOptions {
    WTF?: boolean
    dump?: boolean
    records?: string[]
  }

  interface Presentation {
    slides: unknown[]
    docs: unknown[]
  }

  interface PPT {
    version: string
    readFile(filename: string, opts?: ReadOptions): Presentation
    readBuffer(buffer: Buffer, opts?: ReadOptions): Presentation
    extractText(
      input: string | Buffer,
      options?: {
        separator?: string
        encoding?: string
        outputPath?: string
        readOpts?: ReadOptions
      },
    ): string
    utils: {
      to_text(pres: Presentation): string[]
      toTextString(pres: Presentation, separator?: string): string
    }
  }

  const ppt: PPT
  export default ppt
}
