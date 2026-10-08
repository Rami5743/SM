/**
 * The SM parser.
 *
 * One line, one command. A line is a sequence of tokens separated by spaces
 * or tabs, `//` begins a comment that runs to the end of the line, and every
 * command begins with a keyword written in lower case.
 *
 * The declaration is the one line with punctuation of its own, so spaces
 * inside it are ignored: `function f (a, b) locals t, u` and
 * `function f(a,b) locals t,u` are the same declaration.
 *
 * A call names its target with `call`, so an unrecognised line is a mistake
 * rather than a call to a function nobody declared. The supplied prototype
 * read anything it did not recognise as a call, which turned every typo into
 * a jump to an address the assembler had allocated for a variable, silently
 * (CORRECTIONS C3).
 */
import type { Command, FunctionDecl, Pos, SimpleOp, SmFile, SmFunction } from './ast.js'
import { SIMPLE_OPS } from './ast.js'
import { type Diagnostic, error } from './diagnostic.js'

const SIMPLE = new Set<string>(SIMPLE_OPS)

/** The commands that take one operand, and the keyword that opens a function. */
const WITH_OPERAND = new Set(['push', 'pop', 'label', 'goto', 'if-goto', 'call'])
const KEYWORDS = new Set<string>([...SIMPLE_OPS, ...WITH_OPERAND, 'return', 'function'])

/**
 * A symbol: a letter or underscore, then letters, digits, underscores and
 * dots (CORRECTIONS C8). A leading digit is excluded so that the operand of
 * `push` tells a constant from a global by its first character.
 */
const SYMBOL = /^[A-Za-z_][A-Za-z0-9_.]*$/

/** What follows `function`, with its spaces gone: `name(args)locals names`. */
const DECL = /^([^()]*)\(([^()]*)\)(?:locals(.*))?$/

const MAX_CONST = 32767

export interface ParseResult {
  readonly file: SmFile
  readonly diagnostics: readonly Diagnostic[]
}

/** Strip a `//` comment, and the spaces at either end of what is left. */
export function cleanLine(raw: string): string {
  const cut = raw.indexOf('//')
  const body = cut === -1 ? raw : raw.slice(0, cut)
  return body.replace(/\r/g, '').trim()
}

/** Split `a,b,,c` into names, dropping the empty pieces a trailing comma leaves. */
function names(list: string): string[] {
  return list.split(',').map((n) => n.trim()).filter((n) => n.length > 0)
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
    const tokens = text.split(/[ \t]+/)

    if (tokens[0] === 'function') {
      const decl = declaration(tokens.slice(1).join(''), pos, diagnostics)
      if (decl === undefined) continue
      if (current) functions.push({ decl: current.decl, body: current.body })
      current = { decl, body: [] }
      continue
    }

    const cmd = parseCommand(tokens, pos, diagnostics)
    if (cmd) emit(cmd)
  }
  if (current) functions.push({ decl: current.decl, body: current.body })

  return { file: { file, fragment, functions }, diagnostics }
}

function declaration(rest: string, pos: Pos, diagnostics: Diagnostic[]): FunctionDecl | undefined {
  const parts = DECL.exec(rest)
  if (parts === null) {
    diagnostics.push(error(pos, 'a function is declared `function f(a, b) locals t, u`'))
    return undefined
  }
  const name = parts[1]!
  if (!SYMBOL.test(name)) {
    diagnostics.push(error(pos, `${JSON.stringify(name)} is not a valid function name`))
  }
  return { name, args: names(parts[2]!), locals: names(parts[3] ?? ''), pos }
}

function parseCommand(
  tokens: readonly string[],
  pos: Pos,
  diagnostics: Diagnostic[],
): Command | undefined {
  const head = tokens[0]!
  const operands = tokens.length - 1

  if (SIMPLE.has(head) || head === 'return') {
    if (operands > 0) {
      diagnostics.push(error(pos, `\`${head}\` takes no operand`))
      return undefined
    }
    return head === 'return' ? { kind: 'return', pos } : { kind: 'op', op: head as SimpleOp, pos }
  }

  if (WITH_OPERAND.has(head)) {
    if (operands !== 1) {
      diagnostics.push(error(pos, `\`${head}\` takes one operand, and was given ${operands}`))
      return undefined
    }
    const operand = tokens[1]!
    switch (head) {
      case 'push': return push(operand, pos, diagnostics)
      case 'pop': return pop(operand, pos, diagnostics)
      case 'label': return labelled('label', operand, pos, diagnostics)
      case 'goto': return labelled('goto', operand, pos, diagnostics)
      case 'if-goto': return labelled('ifGoto', operand, pos, diagnostics)
      default: return target(operand, pos, diagnostics)
    }
  }

  if (KEYWORDS.has(head.toLowerCase())) {
    diagnostics.push(error(pos, `a command is written in lower case: \`${head.toLowerCase()}\``))
    return undefined
  }
  diagnostics.push(error(pos, `${JSON.stringify(head)} is not a command`))
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

function target(name: string, pos: Pos, diagnostics: Diagnostic[]): Command | undefined {
  if (!SYMBOL.test(name)) {
    diagnostics.push(error(pos, `${JSON.stringify(name)} is not a valid function name`))
    return undefined
  }
  return { kind: 'call', name, pos }
}

function push(operand: string, pos: Pos, diagnostics: Diagnostic[]): Command | undefined {
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
  if (operand.startsWith('@')) {
    return variable('popLocal', operand.slice(1), pos, diagnostics)
  }
  if (/^[0-9+-]/.test(operand)) {
    diagnostics.push(error(pos, '`pop` needs a variable to pop into, not a constant'))
    return undefined
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
 * one-to-one translation, and the language writes it as a constant followed
 * by `neg` instead (CORRECTIONS C5).
 */
function constant(text: string, pos: Pos, diagnostics: Diagnostic[]): number | undefined {
  if (text.startsWith('-') || text.startsWith('+')) {
    diagnostics.push(
      error(pos, 'a constant may not carry a sign; write `push n` then `neg` for a negative value'),
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
