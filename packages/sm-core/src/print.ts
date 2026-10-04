/**
 * Printing a parsed program back out.
 *
 * Two renderings. `mnemonic` is the language itself and round-trips: parsing
 * its output gives the same tree. `words` spells the structural commands out,
 * so that the two notations can be compared by looking at them rather than
 * argued about (CORRECTIONS C4) — it is a view, not a second input syntax.
 *
 * The arithmetic and logical operators are symbolic in both. Nobody wants to
 * read `add` where `+` will do, and the case for `<-` over `push` is the only
 * part genuinely in question.
 */
import type { Command, FunctionDecl, SmFile } from './ast.js'

export type Notation = 'mnemonic' | 'words'

export function printFile(file: SmFile, notation: Notation = 'mnemonic'): string {
  const out: string[] = []
  for (const cmd of file.fragment) out.push(printCommand(cmd, notation))
  for (const fn of file.functions) {
    out.push(printDecl(fn.decl, notation))
    for (const cmd of fn.body) out.push(printCommand(cmd, notation))
  }
  return out.join('\n') + (out.length > 0 ? '\n' : '')
}

export function printDecl(decl: FunctionDecl, notation: Notation = 'mnemonic'): string {
  const args = decl.args.join(',')
  const locals = decl.locals.join(',')
  if (notation === 'words') {
    const l = locals.length > 0 ? ` locals ${locals}` : ''
    return `function ${decl.name}(${args})${l}`
  }
  return `!${decl.name}(${args})${locals}`
}

export function printCommand(cmd: Command, notation: Notation = 'mnemonic'): string {
  const words = notation === 'words'
  switch (cmd.kind) {
    case 'pushConst': return words ? `push ${cmd.value}` : `<-${cmd.value}`
    case 'pushGlobal': return words ? `push ${cmd.name}` : `<-${cmd.name}`
    case 'pushLocal': return words ? `push @${cmd.name}` : `<-@${cmd.name}`
    case 'popGlobal': return words ? `pop ${cmd.name}` : `->${cmd.name}`
    case 'popLocal': return words ? `pop @${cmd.name}` : `->@${cmd.name}`
    case 'op': return cmd.op
    case 'label': return words ? `label ${cmd.name}` : `${cmd.name}:`
    case 'goto': return words ? `goto ${cmd.name}` : `-->${cmd.name}`
    case 'ifGoto': return words ? `if-goto ${cmd.name}` : `?-->${cmd.name}`
    case 'call': return words ? `call ${cmd.name}` : cmd.name
    case 'return': return words ? 'return' : '<--'
  }
}
