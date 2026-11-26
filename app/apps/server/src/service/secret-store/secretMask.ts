/**
 * What the API shows instead of a saved secret. A form sends it back
 * unchanged to keep the saved secret; an empty value clears it.
 */
export const SECRET_MASK = '••••••••'

export const isSecretMask = (value: unknown) => value === SECRET_MASK
