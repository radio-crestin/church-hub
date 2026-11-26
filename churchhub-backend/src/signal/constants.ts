/** Seconds an offer or an answer waits to be picked up (CF KV minimum: 60). */
export const OFFER_TTL = 60
export const ANSWER_TTL = 60
/** Seconds a room stays open after the host's last register. */
export const ROOM_TTL = 3600

/** Room secrets the apps generate: 32 characters, base64url or [a-z0-9]. */
export const SECRET_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
/**
 * A hosted room's id: "h1" + base64url(SHA-256(host key)), 45 characters.
 * Released apps only ever made 32-character ids, so the formats can't meet.
 */
export const HOSTED_ROOM_PATTERN = /^h1[A-Za-z0-9_-]{43}$/
/** Host keys: base64url, at least 128 bits (the apps send 256). */
export const HOST_KEY_PATTERN = /^[A-Za-z0-9_-]{22,128}$/
export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** An SDP offer or answer is a few kilobytes. */
export const SDP_MAX_LENGTH = 64 * 1024
/** Offers waiting for the host at once; more are refused until it polls. */
export const MAX_PENDING_OFFERS = 50
