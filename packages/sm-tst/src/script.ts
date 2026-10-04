/**
 * The .tst scripting language, as far as our tools need it.
 *
 * The course's shape: commands separated by `,`, a simulation step ended by
 * `;`, `//` comments, and a `repeat n { ... }` block. The one command of our
 * own is `smstep`, which stands where the course's `vmstep` stands.
 */
export type ScriptCommand =
  | { readonly kind: 'load'; readonly file?: string }
  | { readonly kind: 'output-file'; readonly file: string }
  | { readonly kind: 'compare-to'; readonly file: string }
  | { readonly kind: 'output-list'; readonly columns: readonly string[] }
  | { readonly kind: 'set'; readonly target: string; readonly value: number }
  | { readonly kind: 'output' }
  | { readonly kind: 'smstep' }
  | { readonly kind: 'repeat'; readonly times: number; readonly body: readonly ScriptCommand[] }

/** Split into words, with `,` `;` `{` `}` as words of their own. */
function tokenize(source: string): string[] {
  const withoutComments = source
    .split('\n')
    .map((line) => {
      const cut = line.indexOf('//')
      return cut === -1 ? line : line.slice(0, cut)
    })
    .join('\n')
  return withoutComments
    .replace(/([,;{}])/g, ' $1 ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

export function parseScript(source: string): ScriptCommand[] {
  const tokens = tokenize(source)
  let i = 0

  const peek = (): string | undefined => tokens[i]
  const next = (): string => {
    const t = tokens[i]
    if (t === undefined) throw new Error('the script ends in the middle of a command')
    i++
    return t
  }
  const isTerminator = (t: string | undefined): boolean => t === ',' || t === ';'

  function readBlock(end: string | undefined): ScriptCommand[] {
    const out: ScriptCommand[] = []
    while (i < tokens.length) {
      if (peek() === end) { next(); return out }
      const word = next()
      if (isTerminator(word)) continue
      out.push(readCommand(word))
    }
    if (end !== undefined) throw new Error(`the script ends before its ${end}`)
    return out
  }

  function readCommand(word: string): ScriptCommand {
    switch (word) {
      case 'load': {
        // `load` with no name loads the whole directory, as the course's
        // VM-emulator scripts do.
        if (isTerminator(peek())) return { kind: 'load' }
        return { kind: 'load', file: next() }
      }
      case 'output-file': return { kind: 'output-file', file: next() }
      case 'compare-to': return { kind: 'compare-to', file: next() }
      case 'output-list': {
        const columns: string[] = []
        while (!isTerminator(peek()) && peek() !== undefined) columns.push(next())
        if (columns.length === 0) throw new Error('output-list names no columns')
        return { kind: 'output-list', columns }
      }
      case 'set': {
        const target = next()
        const value = Number(next())
        if (!Number.isFinite(value)) throw new Error(`set ${target} needs a number`)
        return { kind: 'set', target, value }
      }
      case 'output': return { kind: 'output' }
      case 'smstep': return { kind: 'smstep' }
      case 'repeat': {
        const times = Number(next())
        if (!Number.isFinite(times)) throw new Error('repeat needs a count')
        const brace = next()
        if (brace !== '{') throw new Error(`repeat wants a { , not ${JSON.stringify(brace)}`)
        return { kind: 'repeat', times, body: readBlock('}') }
      }
      default:
        throw new Error(`${JSON.stringify(word)} is not a command this runner knows`)
    }
  }

  return readBlock(undefined)
}
