/**
 * Where a secret is kept: its table and column and, in a table of many rows
 * (or a settings row holding several secrets), which row or field. It is
 * sealed into the value as associated data, so a value copied to another
 * place no longer opens.
 */
export interface SecretPlace {
  table: string
  column: string
  row?: string
  /**
   * The row's fields that say where the secret is sent: a save that keeps
   * the stored secret must leave them unchanged (requireSameDestination).
   */
  destination?: readonly string[]
}

export const describePlace = ({ table, column, row }: SecretPlace) =>
  row === undefined ? `${table}.${column}` : `${table}.${column}:${row}`
