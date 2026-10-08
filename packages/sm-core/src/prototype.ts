/**
 * The frozen samples, read into the language as it stands.
 *
 * `reference/` holds the supplied prototype and its sample programs, written
 * in the notation the prototype had: `<-7`, `+`, `?-->loop`, `!f(a)b`. The
 * oracle comparison needs both translators to read the same program, and the
 * prototype can only read its own notation, so the samples stay as they are
 * and this converts a copy of one for the current parser.
 *
 * It is for that comparison alone. Nothing a reader of the site ever sees
 * goes through here, and the package does not export it.
 */
const OPS: Readonly<Record<string, string>> = {
  '+': 'add',
  '-': 'sub',
  '(-)': 'neg',
  '~': 'not',
  '&': 'and',
  '|': 'or',
  '==': 'eq',
  '>': 'gt',
  '<': 'lt',
  '[]': 'push-indirect',
  '->[]': 'pop-indirect',
}

const DECL = /^!([^()]*)\(([^()]*)\)(.*)$/

function command(text: string): string {
  if (text === '<--') return 'return'
  const op = OPS[text]
  if (op !== undefined) return op

  const decl = DECL.exec(text)
  if (decl !== null) {
    const locals = decl[3]!.length > 0 ? ` locals ${decl[3]!.split(',').join(', ')}` : ''
    return `function ${decl[1]}(${decl[2]!.split(',').filter((a) => a).join(', ')})${locals}`
  }

  if (text.startsWith('?-->')) return `if-goto ${text.slice(4)}`
  if (text.startsWith('-->')) return `goto ${text.slice(3)}`
  if (text.endsWith(':')) return `label ${text.slice(0, -1)}`
  if (text.startsWith('<-')) return `push ${text.slice(2)}`
  if (text.startsWith('->')) return `pop ${text.slice(2)}`
  return `call ${text}`
}

/** One file of the prototype's notation, line for line, comments kept. */
export function asCurrent(source: string): string {
  return source.split('\n').map((raw) => {
    const cut = raw.indexOf('//')
    const code = (cut === -1 ? raw : raw.slice(0, cut)).replace(/[ \t\r]/g, '')
    if (code.length === 0) return raw.replace(/\r/g, '')
    const comment = cut === -1 ? '' : `  ${raw.slice(cut).trimEnd()}`
    const indent = /^[ \t]*/.exec(raw)![0]
    return `${indent}${command(code)}${comment}`
  }).join('\n')
}
