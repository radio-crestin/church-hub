export const bibleSchemas = {
  BibleTranslation: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      abbreviation: { type: 'string' },
      language: { type: 'string' },
      bookCount: { type: 'integer' },
      verseCount: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  BibleBook: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      translationId: { type: 'integer' },
      bookCode: { type: 'string' },
      bookName: { type: 'string' },
      bookOrder: { type: 'integer' },
      chapterCount: { type: 'integer' },
    },
  },
  BibleChapter: {
    type: 'object',
    properties: {
      chapter: { type: 'integer' },
      verseCount: { type: 'integer' },
    },
  },
  BibleVerse: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      translationId: { type: 'integer' },
      bookId: { type: 'integer' },
      bookCode: { type: 'string' },
      bookName: { type: 'string' },
      chapter: { type: 'integer' },
      verse: { type: 'integer' },
      text: { type: 'string' },
    },
  },
  BibleSearchResult: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      bookName: { type: 'string' },
      chapter: { type: 'integer' },
      verse: { type: 'integer' },
      text: { type: 'string' },
      highlightedText: { type: 'string' },
    },
  },
  BibleSearchResponse: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['reference', 'text'],
        description: 'Whether search was by reference or text',
      },
      results: {
        type: 'array',
        items: { $ref: '#/components/schemas/BibleSearchResult' },
      },
    },
  },
  CreateBibleTranslationInput: {
    type: 'object',
    required: ['xmlContent', 'name', 'abbreviation', 'language'],
    properties: {
      xmlContent: { type: 'string', description: 'USFX XML content' },
      name: { type: 'string', description: 'Translation name' },
      abbreviation: {
        type: 'string',
        description: 'Short abbreviation (e.g., RCCV)',
      },
      language: { type: 'string', description: 'Language code (e.g., ro)' },
    },
  },
  BibleBookmark: {
    type: 'object',
    description:
      'A bookmarked verse. Verse fields are denormalized so the bookmark survives its translation being removed.',
    properties: {
      id: { type: 'integer', description: 'Bookmark row ID' },
      verseId: { type: 'integer', description: 'ID of the bookmarked verse' },
      reference: { type: 'string', example: 'Ioan 3:16' },
      text: { type: 'string', description: 'Verse text' },
      translationAbbreviation: { type: 'string', example: 'RCCV' },
      bookName: { type: 'string', example: 'Ioan' },
      bookCode: { type: 'string', example: 'JHN' },
      translationId: { type: 'integer' },
      bookId: { type: 'integer' },
      chapter: { type: 'integer' },
      verse: { type: 'integer' },
      sortOrder: {
        type: 'integer',
        description: 'Position in the list shared with notes',
      },
      styleRanges: {
        type: 'array',
        description:
          'Highlights, bold and underline saved with the verse. Character offsets into the text above.',
        items: { $ref: '#/components/schemas/BibleBookmarkStyleRange' },
      },
      createdAt: { type: 'integer', description: 'Unix timestamp in ms' },
    },
  },
  BibleBookmarkStyleRange: {
    type: 'object',
    description: 'One run of styling over the verse text',
    required: ['id', 'start', 'end'],
    properties: {
      id: { type: 'string', description: 'Client-generated UUID' },
      start: { type: 'integer', description: 'Character offset, inclusive' },
      end: { type: 'integer', description: 'Character offset, exclusive' },
      highlight: {
        type: 'string',
        description: 'Hex colour, e.g. #FFFF00',
        example: '#FFFF00',
      },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      underline: { type: 'boolean' },
      fontScale: {
        type: 'number',
        description: 'Multiplier applied to this run of text',
      },
    },
  },
  BibleBookmarkNote: {
    type: 'object',
    description: 'A free-text heading that sits between bookmarked verses',
    properties: {
      id: { type: 'integer' },
      content: { type: 'string' },
      sortOrder: {
        type: 'integer',
        description: 'Position in the list shared with bookmarks',
      },
      createdAt: { type: 'integer', description: 'Unix timestamp in ms' },
    },
  },
  BibleBookmarkItemRef: {
    type: 'object',
    required: ['type', 'id'],
    properties: {
      type: { type: 'string', enum: ['verse', 'note'] },
      id: { type: 'integer', description: 'Row ID of the verse or note' },
    },
  },
  BibleBookmarkImportResult: {
    type: 'object',
    properties: {
      imported: { type: 'integer', description: 'Verses added' },
      notes: { type: 'integer', description: 'Notes added' },
      errors: {
        type: 'array',
        description: 'Lines that could not be imported',
        items: {
          type: 'object',
          properties: {
            line: { type: 'integer', description: '1-based line number' },
            content: { type: 'string', description: 'The offending line' },
            reason: {
              type: 'string',
              enum: [
                'unknown_reference',
                'verse_required',
                'verse_not_found',
                'no_translation',
              ],
            },
          },
        },
      },
    },
  },
}
