/**
 * The SM parser.
 *
 * One line, one command. The language says that spaces and tabs are removed
 * from a line before it is read (spec/sm.md section 1.2), which this keeps
 * deliberately: it means no command has a whitespace rule of its own, and
 * `? --> loop` and `?-->loop` are the same command.
 *
 * The supplied implementation ends its table of patterns with a catch-all that
 * reads anything unrecognised as a call. That turns every typo into a call to
 * a function nobody declared, and thence — since the Hack assembler allocates
 * an unknown symbol as a variable rather than complaining — into a jump to an
 * arbitrary address, silently (CORRECTIONS C3). We keep the catch-all, because
 * a call really is a bare name, but the resolve pass makes an undeclared
 * target an error, which is what turns the silence into a message.
 */
import type { Command, FunctionDecl, Pos, SimpleOp, SmFile, SmFunction } from './ast.js'
import { SIMPLE_OPS } from './ast.js'
import { type Diagnostic, error } from './diagnostic.js'

const SIMPLE = new Set<string>(SIMPLE_OPS)

/**
 * A symbol: a letter or underscore, then letters, digits, underscores and
 * dots (CORRECTIONS C8). A leading digit is excluded so that the operand of
 * `<-` tells a constant from a global by its first character.
 */
const SYMBOL = /^[A-Za-z_][A-Za-z0-9_.]*$/

/** `! name(args) locals` — the lists may be empty. */
const DECL = /^!([^()]*)\(([^()]*)\)(.*)$/

const MAX_CONST = 32767

export interface ParseResult {
  readonly file: SmFile
  readonly diagnostics: readonly Diagnostic[]
}

/** Strip a `//` comment and then every space and tab. */
export function cleanLine(raw: string): string {
  const cut = raw.indexOf('//')
  const body = cut === -1 ? raw : raw.slice(0, cut)
  return body.replace(/[ \t\r]/g, '')
}

/** Split `a,b,,c` into names, dropping the empty pieces a trailing comma leaves. */
function names(list: string): string[] {
  return list.split(',').filter((n) => n.length > 0)
}

export function parse(file: string, source: string): ParseResult {
  const diagnostics: Diagnostic[] = []
  const fragment: Command[] = []
  const functions: SmFunction[] = []
  let current: { decl: FunctionDecl; body: Command[] } | undefined

  const emit = (cmd: Command): void => {
    if (current) current.body.push(cmd)
    else fragment.push(cmd)
  }

  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const text = cleanLine(lines[i]!)
    if (text.length === 0) continue
    const pos: Pos = { file, line: i + 1 }

    const decl = DECL.exec(text)
    if (decl) {
      if (current) functions.push({ decl: current.decl, body: current.body })
      const name = decl[1]!
      if (!SYMBOL.test(name)) {
        diagnostics.push(error(pos, `${JSON.stringify(name)} is not a valid function name`))
      }
      current = {
        decl: { name, args: names(decl[2]!), locals: names(decl[3]!), pos },
        body: [],
      }
      continue
    }

    const cmd = parseCommand(text, pos, diagnostics)
    if (cmd) emit(cmd)
  }
  if (current) functions.push({ decl: current.decl, body: current.body })

  return { file: { file, fragment, functions }, diagnostics }
}

function parseCommand(text: string, pos: Pos, diagnostics: Diagnostic[]): Command | undefined {
  // `<--` before `<-`, or the return reads as a push of a global named `-`.
  if (text === '<--') return { kind: 'return', pos }

  if (SIMPLE.has(text)) return { kind: 'op', op: text as SimpleOp, pos }

  if (text === '=') {
    diagnostics.push(error(pos, 'the equality command is `==`, not `=`'))
    return undefined
  }

  if (text.startsWith('?-->')) {
    return labelled('ifGoto', text.slice(4), pos, diagnostics)
  }
  if (text.startsWith('-->')) {
    return labelled('goto', text.slice(3), pos, diagnostics)
  }
  if (text.endsWith(':')) {
    return labelled('label', text.slice(0, -1), pos, diagnostics)
  }

  if (text.startsWith('<-')) return push(text.slice(2), pos, diagnostics)
  if (text.startsWith('->')) return pop(text.slice(2), pos, diagnostics)

  // Whatever is left is a call, which is a bare name and nothing else.
  if (SYMBOL.test(text)) return { kind: 'call', name: text, pos }

  diagnostics.push(error(pos, `${JSON.stringify(text)} is not a command`))
  return undefined
}

function labelled(
  kind: 'label' | 'goto' | 'ifGoto',
  name: string,
  pos: Pos,
  diagnostics: Diagnostic[],
): Command | undefined {
  if (!SYMBOL.test(name)) {
    diagnostics.push(error(pos, `${JSON.stringify(name)} is not a valid label name`))
    return undefined
  }
  return { kind, name, pos }
}

function push(operand: string, pos: Pos, diagnostics: Diagnostic[]): Command | undefined {
  if (operand.length === 0) {
    diagnostics.push(error(pos, '`<-` needs something to push'))
    return undefined
  }
  if (operand.startsWith('@')) {
    return variable('pushLocal', operand.slice(1), pos, diagnostics)
  }
  if (/^[0-9]/.test(operand) || operand.startsWith('-') || operand.startsWith('+')) {
    const value = constant(operand, pos, diagnostics)
    return value === undefined ? undefined : { kind: 'pushConst', value, pos }
  }
  return variable('pushGlobal', operand, pos, diagnostics)
}

function pop(operand: string, pos: Pos, diagnostics: Diagnostic[]): Command | undefined {
  if (operand.length === 0) {
    diagnostics.push(error(pos, '`->` needs somewhere to pop to'))
    return undefined
  }
  if (operand.startsWith('@')) {
    return variable('popLocal', operand.slice(1), pos, diagnostics)
  }
  return variable('popGlobal', operand, pos, diagnostics)
}

function variable(
  kind: 'pushLocal' | 'pushGlobal' | 'popLocal' | 'popGlobal',
  name: string,
  pos: Pos,
  diagnostics: Diagnostic[],
): Command | undefined {
  if (!SYMBOL.test(name)) {
    diagnostics.push(error(pos, `${JSON.stringify(name)} is not a valid variable name`))
    return undefined
  }
  return { kind, name, pos }
}

/**
 * A constant is a decimal in 0..32767. A leading sign is an error: the Hack
 * A-instruction has fifteen bits and no sign, so a negative constant is not a
 * one-to-one translation, and the language writes it as a constant followed by
 * `(-)` instead (CORRECTIONS C5).
 */
function constant(text: string, pos: Pos, diagnostics: Diagnostic[]): number | undefined {
  if (text.startsWith('-') || text.startsWith('+')) {
    diagnostics.push(
      error(pos, 'a constant may not carry a sign; write `<- n` then `(-)` for a negative value'),
    )
    return undefined
  }
  if (!/^[0-9]+$/.test(text)) {
    diagnostics.push(error(pos, `${JSON.stringify(text)} is not a decimal constant`))
    return undefined
  }
  const value = Number(text)
  if (value > MAX_CONST) {
    diagnostics.push(error(pos, `${value} is above the largest constant, ${MAX_CONST}`))
    return undefined
  }
  return value
}
