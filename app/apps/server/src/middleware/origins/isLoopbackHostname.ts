/**
 * Whether a hostname (as in a URL, IPv6 in brackets) is this machine's
 * loopback: `localhost`, a 127.x address or `[::1]`. A website that
 * rebinds its own domain to 127.0.0.1 still sends that domain, never one
 * of these.
 */
export function isLoopbackHostname(name: string): boolean {
  const host = name.toLowerCase()
  return (
    host === 'localhost' || host === '[::1]' || /^127(\.\d{1,3}){3}$/.test(host)
  )
}
