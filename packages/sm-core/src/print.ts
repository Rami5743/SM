/**
 * Printing a parsed program back out.
 *
 * The output is the language, and it round-trips: parsing it gives the same
 * tree. Comments and indentation are dropped, which is right — they are not
 * in the tree.
 */
import type { Command, FunctionDecl, SmFile } from './ast.js'

export function printFile(file: SmFile): string {
  const out: string[] = []
  for (const cmd of file.fragment) out.push(printCommand(cmd))
  for (const fn of file.functions) {
    out.push(printDecl(fn.decl))
    for (const cmd of fn.body) out.push(printCommand(cmd))
  }
  return out.join('\n') + (out.length > 0 ? '\n' : '')
}

export function printDecl(decl: FunctionDecl): string {
  const locals = decl.locals.length > 0 ? ` locals ${decl.locals.join(', ')}` : ''
  return `function ${decl.name}(${decl.args.join(', ')})${locals}`
}

export function printCommand(cmd: Command): string {
  switch (cmd.kind) {
    case 'pushConst': return `push ${cmd.value}`
    case 'pushGlobal': return `push ${cmd.name}`
    case 'pushLocal': return `push @${cmd.name}`
    case 'popGlobal': return `pop ${cmd.name}`
    case 'popLocal': return `pop @${cmd.name}`
    case 'op': return cmd.op
    case 'label': return `label ${cmd.name}`
    case 'goto': return `goto ${cmd.name}`
    case 'ifGoto': return `if-goto ${cmd.name}`
    case 'call': return `call ${cmd.name}`
    case 'return': return 'return'
  }
}
