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
}
