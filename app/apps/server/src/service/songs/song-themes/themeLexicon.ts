import { themeStem } from './themeStem'

/**
 * The themes a church sings about, each with the words that name it
 * (ASCII-folded, as `tokenize` gives them). A song holding them is on that
 * theme; the client shows the theme by its id (`songs:sameTheme.themes.<id>`).
 */
const THEME_WORDS = {
  christmas: [
    'craciun',
    'craciunul',
    'betleem',
    'bethleem',
    'iesle',
    'ieslea',
    'magii',
    'colinda',
    'prunc',
    'pruncul',
  ],
  easter: ['inviere', 'invierea', 'inviat', 'pastele', 'mormantul', 'mormant'],
  cross: [
    'cruce',
    'crucea',
    'golgota',
    'calvar',
    'calvarul',
    'jertfa',
    'jertfit',
    'rastignit',
    'rastignire',
    'cuie',
    'piroane',
    'sangele',
  ],
  lordsSupper: ['cina', 'cinei', 'painea', 'paharul', 'frangem', 'trupul'],
  baptism: ['botez', 'botezul', 'botezat', 'botezati', 'iordan', 'iordanul'],
  pentecost: [
    'rusalii',
    'rusaliile',
    'cincizecime',
    'cincizecimea',
    'flacari',
    'limbi',
  ],
  thanksgiving: [
    'multumire',
    'multumim',
    'multumesc',
    'multumiri',
    'seceris',
    'secerisul',
    'roade',
    'roadele',
    'recolta',
    'snopi',
  ],
  wedding: [
    'nunta',
    'nunti',
    'mire',
    'mirele',
    'miri',
    'mirilor',
    'casatorie',
    'casnicie',
  ],
  farewell: [
    'despartire',
    'despartirea',
    'adio',
    'mangaiere',
    'mangaierea',
    'jale',
    'doliu',
  ],
  secondComing: [
    'revenirea',
    'revenire',
    'trambita',
    'trambitei',
    'rapire',
    'rapirea',
    'nori',
    'norii',
  ],
  heaven: [
    'ierusalim',
    'ierusalimul',
    'cetate',
    'cetatea',
    'paradis',
    'raiul',
    'patria',
  ],
  shepherd: [
    'pastor',
    'pastorul',
    'turma',
    'toiag',
    'toiagul',
    'pasune',
    'pasuni',
    'mielusei',
  ],
  prayer: ['rugaciune', 'rugaciunea', 'rugaciuni', 'genunchi', 'rugam'],
  mother: ['mama', 'mamei', 'mamica', 'mamelor'],
  repentance: [
    'pocainta',
    'pocaieste',
    'risipitor',
    'risipitorul',
    'iertare',
    'iertarea',
  ],
  mission: [
    'misiune',
    'misionar',
    'evanghelia',
    'evanghelie',
    'vestiti',
    'mergeti',
  ],
  scripture: ['cuvantul', 'biblia', 'scriptura', 'scripturi', 'scripturile'],
} as const

export type ThemeId = keyof typeof THEME_WORDS

/** Theme stem → the themes it names. */
export const THEMES_OF_STEM: ReadonlyMap<string, readonly ThemeId[]> = (() => {
  const themes = new Map<string, ThemeId[]>()
  for (const [theme, words] of Object.entries(THEME_WORDS)) {
    for (const stem of new Set(words.map(themeStem))) {
      themes.set(stem, [...(themes.get(stem) ?? []), theme as ThemeId])
    }
  }
  return themes
})()

/**
 * Words too plain to tell a theme that the library's own counts don't
 * catch (each in fewer than `MAX_STEM_SHARE` of the songs).
 */
export const PLAIN_WORDS: ReadonlySet<string> = new Set(
  [
    'avea',
    'ati',
    'cati',
    'sigur',
    'fiindca',
    'dati',
    'aici',
    'stiind',
    'vrei',
    'intru',
    'aliluia',
    'aleluia',
    'amin',
  ].map(themeStem),
)
