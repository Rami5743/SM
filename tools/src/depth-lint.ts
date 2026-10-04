/**
 * The stack-depth walk, as a lint over the SM our own compiler generates.
 *
 * Q9 declined this as a rule of the language: a program that grows the stack
 * in a loop is legal SM, exactly as it is legal VM, and the emulator bounds
 * the stack at run time rather than refusing the program. So this lives in
 * `tools/`, never beside the real diagnostics in `sm-core`, and the emulator
 * neither performs it nor knows of it.
 *
 * What it is for: a compiler that forgets to discard a statement call's value
 * emits perfectly legal SM that grows the stack by a cell per iteration, and
 * nothing notices until a loop has run long enough to walk into the heap.
 * This catches it at once, naming the function. It is also what found the
 * real defect in the supplied prototype — a call pushing a receiver the
 * function does not take leaves the body at depth 2 where `<--` wants 1.
 */
import type { Command, SmFile } from '@sm/core'

export interface DepthProblem {
  readonly file: string
  readonly line: number
  readonly fn: string
  readonly message: string
}

/** How each command changes the depth of the stack above the locals. */
function effect(cmd: Command, arity: (name: string) => number | undefined): number | undefined {
  switch (cmd.kind) {
    case 'pushConst':
    case 'pushGlobal':
    case 'pushLocal': return +1
    case 'popGlobal':
    case 'popLocal': return -1
    case 'ifGoto': return -1
    case 'goto':
    case 'label':
    case 'return': return 0
    case 'op':
      switch (cmd.op) {
        case '(-)': case '~': case '[]': return 0
        case '->[]': return -2
        default: return -1
      }
    case 'call': {
      const a = arity(cmd.name)
      return a === undefined ? undefined : 1 - a
    }
  }
}

export function lintDepth(files: readonly SmFile[]): DepthProblem[] {
  const arities = new Map<string, number>()
  for (const f of files) for (const fn of f.functions) arities.set(fn.decl.name, fn.decl.args.length)
  const arity = (name: string) => arities.get(name)

  const problems: DepthProblem[] = []

  for (const file of files) {
    for (const fn of file.functions) {
      const body = fn.decl
      const labelAt = new Map<string, number>()
      fn.body.forEach((c, i) => { if (c.kind === 'label') labelAt.set(c.name, i) })

      // Depth at each command, filled in as the walk reaches it. A command
      // with no depth yet has not been reached.
      const depth = new Array<number | undefined>(fn.body.length).fill(undefined)
      const todo: Array<{ at: number; depth: number }> = [{ at: 0, depth: 0 }]

      const arrive = (at: number, d: number, from: Command): void => {
        if (at >= fn.body.length) return
        const known = depth[at]
        if (known === undefined) { todo.push({ at, depth: d }); return }
        if (known !== d) {
          problems.push({
            file: file.file, line: from.pos.line, fn: body.name,
            message: `two paths reach this point at different stack depths, ${known} and ${d}`,
          })
        }
      }

      while (todo.length > 0) {
        const { at, depth: d } = todo.pop()!
        if (depth[at] !== undefined) continue
        depth[at] = d
        const cmd = fn.body[at]!

        if (cmd.kind === 'return') {
          if (d !== 1) {
            problems.push({
              file: file.file, line: cmd.pos.line, fn: body.name,
              message: `\`<--\` wants exactly one value above the locals, and finds ${d}`,
            })
          }
          continue
        }

        const change = effect(cmd, arity)
        if (change === undefined) continue // an unresolved call; sm-core reports it
        const after = d + change
        if (after < 0) {
          problems.push({
            file: file.file, line: cmd.pos.line, fn: body.name,
            message: 'this takes more from the stack than the function has put there',
          })
          continue
        }

        if (cmd.kind === 'goto') {
          const target = labelAt.get(cmd.name)
          if (target !== undefined) arrive(target, after, cmd)
          continue
        }
        if (cmd.kind === 'ifGoto') {
          const target = labelAt.get(cmd.name)
          if (target !== undefined) arrive(target, after, cmd)
        }
        arrive(at + 1, after, cmd)
      }
    }
  }

  return problems
}
