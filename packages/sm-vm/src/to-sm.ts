/**
 * The course's VM to SM.
 *
 * The segments collapse, and where they collapse to is the argument the
 * design makes. `this i` is an address on the stack, an addition and `[]`;
 * the whole `pointer`/`that` apparatus is gone. `pop this i` costs one
 * instruction more than it might, because SM cannot swap the top two cells
 * and `->[]` wants the address underneath, so the value steps aside into a
 * global for one instruction.
 *
 * Where the pointers live. `this`, `that`, `pointer` and `temp` stay in the
 * cells the VM specification puts them in — RAM[3], RAM[4] and RAM[5..12] —
 * reached with `<-3 []` and the like. Nothing in SM uses those cells, the
 * translation is then exactly the VM's own, and a test script that sets
 * `this` by name is setting the cell the program reads.
 *
 * `argument` and `local` are different: inside a function they are the
 * frame, so they become named SM locals, which is the point of the
 * exercise. Outside one — a project 7 `.vm` file is a bare run of commands,
 * which is an SM fragment — there is no frame, so they go through RAM[2]
 * and RAM[1] as the VM has them, and the script's `set local 300` lands
 * where the program looks.
 *
 * One thing has to be added. The VM's `call` saves `THIS` and `THAT` in the
 * frame and its `return` puts them back; SM's frame saves one pointer and a
 * return address, because it has no segments to save. A VM program may rely
 * on the restore — the course's `NestedCall` is written to test exactly
 * that — so where a program writes `pointer` at all, every call is wrapped
 * in a save and a restore of those two cells, through two internal
 * variables of the caller. Four instructions a call, and none at all for a
 * program that never re-points.
 *
 * Two things have to be recovered rather than read.
 *
 * **The argument count.** `function f k` gives the local count and nothing
 * gives the argument count, so it is the larger of what the call sites pass
 * and one past the largest `argument i` the body touches. A function called
 * with two different counts is an error, and a true one: SM declares the
 * count once.
 *
 * **The boolean convention.** The VM's `eq`, `gt` and `lt` return all-ones
 * or zero and a VM program may do arithmetic with that, so SM has to produce
 * the same value and not merely the same sign; the comparison leaves its
 * answer in the most significant bit and a branch turns that into the two
 * values. The other way round, `if-goto` branches on "not zero" where
 * `?-->` branches on "negative", so it becomes `<-0`, `==`, `~`, `?-->`.
 */
import { BridgeError } from './to-vm.js'
import type { VmCommand, VmFile } from './vm.js'

/** The cells the VM specification names, read and written as themselves. */
const LCL = 1
const ARG = 2
const THIS = 3
const THAT = 4
const TEMP = 5

/**
 * Where a value waits while the address it belongs under is computed. A
 * program being translated cannot collide with this: SM globals come from
 * the VM's `static`, which this names `File.i`, and no file is called `VM`
 * because `VM.vm` would make the segment keyword a file name.
 */
const SCRATCH = 'VM.scratch'

export interface ToSmResult {
  readonly sm: string
  /** Each function and the argument count recovered for it. */
  readonly arity: ReadonlyMap<string, number>
}

/** A VM name SM can spell. The VM allows `:`, which SM does not. */
function symbol(name: string, where: string): string {
  const clean = name.replace(/:/g, '_')
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(clean)) {
    throw new BridgeError(`${where}: ${JSON.stringify(name)} is not a name SM can spell`)
  }
  return clean
}

/** The two internal variables a call's save and restore uses. */
const SAVED_THIS = 'vm.this'
const SAVED_THAT = 'vm.that'

export function vmToSm(files: readonly VmFile[]): ToSmResult {
  const arity = recoverArity(files)
  // Only a program that re-points pays for the save and the restore.
  const repoints = files.some((f) => f.commands.some(
    (c) => c.kind === 'pop' && c.segment === 'pointer',
  ))
  const fragment: string[] = []
  const functions: string[] = []
  let labels = 0

  for (const file of files) {
    let inside: string | undefined
    for (const c of file.commands) {
      const where = `${c.pos.file}: in line ${c.pos.line}`
      if (c.kind === 'function') {
        inside = c.name
        const args = arity.get(c.name) ?? 0
        const argNames = Array.from({ length: args }, (_, i) => `a${i}`)
        const localNames = Array.from({ length: c.locals }, (_, i) => `l${i}`)
        if (repoints) localNames.push(SAVED_THIS, SAVED_THAT)
        functions.push(`!${symbol(c.name, where)}(${argNames.join(',')})${localNames.join(',')}`)
        continue
      }
      const lines = c.kind === 'call' && repoints && inside !== undefined
        ? [
          `<-${THIS}`, '[]', `->@${SAVED_THIS}`,
          `<-${THAT}`, '[]', `->@${SAVED_THAT}`,
          symbol(c.name, where),
          `<-${THIS}`, `<-@${SAVED_THIS}`, '->[]',
          `<-${THAT}`, `<-@${SAVED_THAT}`, '->[]',
        ]
        : translate(c, file, where, inside !== undefined, () => labels++)
      ;(inside === undefined ? fragment : functions).push(...lines)
    }
  }

  const all = [...fragment, ...functions]
  return { sm: all.length === 0 ? '' : `${all.join('\n')}\n`, arity }
}

function recoverArity(files: readonly VmFile[]): Map<string, number> {
  const arity = new Map<string, number>()
  const note = (name: string, args: number, where: string) => {
    const known = arity.get(name)
    if (known === undefined) { arity.set(name, args); return }
    if (known !== args) {
      throw new BridgeError(
        `${where}: ${name} is called with ${known} arguments and with ${args}, and SM declares the count once`,
      )
    }
  }
  for (const file of files) {
    let current: string | undefined
    let widest = 0
    const close = () => {
      if (current !== undefined) arity.set(current, Math.max(arity.get(current) ?? 0, widest))
    }
    for (const c of file.commands) {
      if (c.kind === 'call') note(c.name, c.args, `${c.pos.file}: in line ${c.pos.line}`)
      if (c.kind === 'function') { close(); current = c.name; widest = 0; continue }
      if ((c.kind === 'push' || c.kind === 'pop') && c.segment === 'argument') {
        widest = Math.max(widest, c.index + 1)
      }
    }
    close()
  }
  return arity
}

/** Push the contents of the cell at `base` plus `index`. */
function throughPointer(base: number, index: number): string[] {
  return [`<-${base}`, '[]', `<-${index}`, '+', '[]']
}

/** Store the value on top into the cell at `base` plus `index`. */
function intoPointer(base: number, index: number): string[] {
  return [`->${SCRATCH}`, `<-${base}`, '[]', `<-${index}`, '+', `<-${SCRATCH}`, '->[]']
}

function translate(
  c: VmCommand,
  file: VmFile,
  where: string,
  inFunction: boolean,
  nextLabel: () => number,
): string[] {
  switch (c.kind) {
    case 'push':
      switch (c.segment) {
        case 'constant': return [`<-${c.index}`]
        case 'argument': return inFunction ? [`<-@a${c.index}`] : throughPointer(ARG, c.index)
        case 'local': return inFunction ? [`<-@l${c.index}`] : throughPointer(LCL, c.index)
        case 'static': return [`<-${file.name}.${c.index}`]
        case 'temp': return [`<-${TEMP + c.index}`, '[]']
        case 'pointer': return [`<-${THIS + c.index}`, '[]']
        case 'this': return throughPointer(THIS, c.index)
        case 'that': return throughPointer(THAT, c.index)
      }
      break
    case 'pop':
      switch (c.segment) {
        case 'argument': return inFunction ? [`->@a${c.index}`] : intoPointer(ARG, c.index)
        case 'local': return inFunction ? [`->@l${c.index}`] : intoPointer(LCL, c.index)
        case 'static': return [`->${file.name}.${c.index}`]
        case 'temp': return [`->${SCRATCH}`, `<-${TEMP + c.index}`, `<-${SCRATCH}`, '->[]']
        case 'pointer': return [`->${SCRATCH}`, `<-${THIS + c.index}`, `<-${SCRATCH}`, '->[]']
        case 'this': return intoPointer(THIS, c.index)
        case 'that': return intoPointer(THAT, c.index)
        case 'constant': break
      }
      break
    case 'arithmetic':
      switch (c.op) {
        case 'add': return ['+']
        case 'sub': return ['-']
        case 'neg': return ['(-)']
        case 'and': return ['&']
        case 'or': return ['|']
        case 'not': return ['~']
        case 'eq': return canonical('==', nextLabel())
        case 'gt': return canonical('>', nextLabel())
        case 'lt': return canonical('<', nextLabel())
      }
      break
    case 'label': return [`${symbol(c.name, where)}:`]
    case 'goto': return [`-->${symbol(c.name, where)}`]
    // "not zero", read at the most significant bit.
    case 'ifGoto': return ['<-0', '==', '~', `?-->${symbol(c.name, where)}`]
    case 'call': return [symbol(c.name, where)]
    case 'return': return ['<--']
    case 'function': break
  }
  throw new BridgeError(`${where}: this command cannot be translated`)
}

/**
 * An SM comparison leaves its answer in the most significant bit; the VM
 * wants all-ones or zero, because a VM program may go on to do arithmetic
 * with it. The branch is what turns the one into the other.
 */
function canonical(op: '==' | '<' | '>', n: number): string[] {
  return [op, `?-->vm.true.${n}`, '<-0', `-->vm.end.${n}`, `vm.true.${n}:`, '<-1', '(-)', `vm.end.${n}:`]
}
