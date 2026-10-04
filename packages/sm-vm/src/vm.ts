/**
 * The course's VM language: enough of it to read and write.
 *
 * This is not a reimplementation of anything. The course's VM emulator and
 * its VM translator both exist and we use them as they are; what we need is
 * a syntax to cross between the two machines, so this parses and prints and
 * does nothing else.
 */
export const SEGMENTS = [
  'argument', 'local', 'static', 'constant', 'this', 'that', 'pointer', 'temp',
] as const
export type Segment = (typeof SEGMENTS)[number]

export const ARITHMETIC = ['add', 'sub', 'neg', 'eq', 'gt', 'lt', 'and', 'or', 'not'] as const
export type Arithmetic = (typeof ARITHMETIC)[number]

export interface VmPos {
  readonly file: string
  readonly line: number
}

export type VmCommand =
  | { readonly kind: 'push'; readonly segment: Segment; readonly index: number; readonly pos: VmPos }
  | { readonly kind: 'pop'; readonly segment: Segment; readonly index: number; readonly pos: VmPos }
  | { readonly kind: 'arithmetic'; readonly op: Arithmetic; readonly pos: VmPos }
  | { readonly kind: 'label'; readonly name: string; readonly pos: VmPos }
  | { readonly kind: 'goto'; readonly name: string; readonly pos: VmPos }
  | { readonly kind: 'ifGoto'; readonly name: string; readonly pos: VmPos }
  | { readonly kind: 'function'; readonly name: string; readonly locals: number; readonly pos: VmPos }
  | { readonly kind: 'call'; readonly name: string; readonly args: number; readonly pos: VmPos }
  | { readonly kind: 'return'; readonly pos: VmPos }

export interface VmFile {
  /** Without the `.vm`: it is the name a `static` belongs to. */
  readonly name: string
  readonly commands: readonly VmCommand[]
}

export class VmError extends Error {
  constructor(readonly pos: VmPos, message: string) {
    super(`${pos.file}: in line ${pos.line}: ${message}`)
    this.name = 'VmError'
  }
}

function index(text: string | undefined, pos: VmPos): number {
  if (text === undefined || !/^\d+$/.test(text)) {
    throw new VmError(pos, `expected an index, found ${JSON.stringify(text ?? '')}`)
  }
  return Number(text)
}

export function parseVm(name: string, source: string): VmFile {
  const commands: VmCommand[] = []
  // The course's files are checked in with CRLF, and in a JavaScript regular
  // expression `\r` is a line terminator, so `.` will not cross it.
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  for (const [i, raw] of lines.entries()) {
    const pos: VmPos = { file: `${name}.vm`, line: i + 1 }
    const text = raw.replace(/\/\/.*$/, '').trim()
    if (text === '') continue
    const parts = text.split(/\s+/)
    const head = parts[0]!

    if (head === 'push' || head === 'pop') {
      const segment = SEGMENTS.find((s) => s === parts[1])
      if (segment === undefined) throw new VmError(pos, `${JSON.stringify(parts[1] ?? '')} is not a segment`)
      if (head === 'pop' && segment === 'constant') throw new VmError(pos, 'there is nothing to pop into constant')
      commands.push({ kind: head, segment, index: index(parts[2], pos), pos })
      continue
    }
    const op = ARITHMETIC.find((a) => a === head)
    if (op !== undefined) { commands.push({ kind: 'arithmetic', op, pos }); continue }
    if (head === 'label' || head === 'goto') {
      if (parts[1] === undefined) throw new VmError(pos, `${head} needs a label`)
      commands.push({ kind: head, name: parts[1], pos })
      continue
    }
    if (head === 'if-goto') {
      if (parts[1] === undefined) throw new VmError(pos, 'if-goto needs a label')
      commands.push({ kind: 'ifGoto', name: parts[1], pos })
      continue
    }
    if (head === 'function') {
      if (parts[1] === undefined) throw new VmError(pos, 'function needs a name')
      commands.push({ kind: 'function', name: parts[1], locals: index(parts[2], pos), pos })
      continue
    }
    if (head === 'call') {
      if (parts[1] === undefined) throw new VmError(pos, 'call needs a name')
      commands.push({ kind: 'call', name: parts[1], args: index(parts[2], pos), pos })
      continue
    }
    if (head === 'return') { commands.push({ kind: 'return', pos }); continue }
    throw new VmError(pos, `${JSON.stringify(head)} is not a VM command`)
  }
  return { name, commands }
}

export function printVm(commands: readonly VmCommand[]): string {
  const out = commands.map((c) => {
    switch (c.kind) {
      case 'push': return `push ${c.segment} ${c.index}`
      case 'pop': return `pop ${c.segment} ${c.index}`
      case 'arithmetic': return c.op
      case 'label': return `label ${c.name}`
      case 'goto': return `goto ${c.name}`
      case 'ifGoto': return `if-goto ${c.name}`
      case 'function': return `function ${c.name} ${c.locals}`
      case 'call': return `call ${c.name} ${c.args}`
      case 'return': return 'return'
    }
  })
  return out.length === 0 ? '' : `${out.join('\n')}\n`
}
