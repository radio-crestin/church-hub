/**
 * A synonym group where primary term has alternative synonyms
 * Example: { primary: "cristos", synonyms: ["hristos"] }
 */
export interface SynonymGroup {
  id: string
  primary: string
  synonyms: string[]
}

/**
 * Collection of all synonym groups stored in settings
 */
export interface SynonymsConfig {
  groups: SynonymGroup[]
}
