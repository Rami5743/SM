/**
 * A program in the address bar.
 *
 * The text goes in the fragment, which never reaches a server, so a shared
 * link carries the program and nothing else is needed to host it. Base64 of
 * the UTF-8 bytes, in the URL-safe alphabet.
 */
const PREFIX = '#p='

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string | undefined {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return undefined
  }
}

/** The link to this page carrying the given program. */
export function shareLink(program: string): string {
  return `${location.origin}${location.pathname}${PREFIX}${toBase64Url(program)}`
}

/** The program a link carries, if it carries one. */
export function sharedProgram(hash = location.hash): string | undefined {
  if (!hash.startsWith(PREFIX)) return undefined
  return fromBase64Url(hash.slice(PREFIX.length))
}
