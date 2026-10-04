/**
 * SM to the course's VM.
 *
 * Not an assignment: a bridge, so a program can cross between the two tracks
 * and each machine can check the other.
 *
 * Three things make it more than a table.
 *
 * **A function table, and so two passes.** The course's VM writes the
 * argument count at the *call* site; SM writes it at the declaration, which
 * is the whole reason an SM translator needs neither a table nor a second
 * pass. Going the other way the debt comes due.
 *
 * **Globals do not map to `static`.** They cannot: `static i` in one `.vm`
 * file is a different cell from `static i` in another, so the VM has no
 * shared-global storage, whatever the globals are named. Each global gets a
 * fixed address instead, reached through `pointer 1` and `that 0`: uniform
 * for every global, and needing no naming convention.
 *
 * Which addresses was measured rather than chosen. RAM[16..255] would have
 * been the natural answer, that being where the course's own statics live,
 * but its VM emulator refuses a `that` outside the heap and the screen —
 * `'That' segment must be in the Heap or Screen range` — so the globals go
 * at the top of the heap and grow downwards. A translated program that
 * also manages the heap itself, as `Memory` does, has to be given a heap
 * that ends below them, and the bridge cannot do that for it; this is a
 * limit of the bridge, stated rather than hidden.
 *
 * **The comparisons are subtractions.** SM's `<` is `x - y` and gives
 * meaning to the most significant bit alone, where the VM's `lt` returns
 * all-ones or zero. Emitting `lt` would be close enough for a program that
 * only branches on the result and wrong for one that does arithmetic with
 * it, and both are legal SM. So `<` becomes `sub` and `>` becomes
 * `sub, neg`, which is exactly what SM does, bit for bit. The conditional
 * jump then carries the difference instead: `?-->` branches on "negative",
 * `if-goto` on "non-zero", so `?--> L` becomes
 * `push constant 0; lt; if-goto L`.
 */
import { ADDR } from '@sm/emulator'
import type { Command, SmFile } from '@sm/core'
import type { VmCommand, VmPos } from './vm.js'

export interface ToVmResult {
  /**
   * File name to VM text. The course's VM emulator insists that
   * `function X.y` live in `X.vm`, so a program is split by the part of
   * each name before its first dot; a function with no dot has no class to
   * belong to and goes in `Main.vm`.
   */
  readonly files: Readonly<Record<string, string>>
  /** Each global and the RAM cell it was given. */
  readonly globals: ReadonlyMap<string, number>
}

export class BridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeError'
  }
}

/** Where `->[]` parks the value while it sets `that`. */
const SCRATCH = 0

/** A command without its position. Distributive, so the union survives. */
type Bare<T> = T extends unknown ? Omit<T, 'pos'> : never
type BareVm = Bare<VmCommand>

export function smToVm(files: readonly SmFile[]): ToVmResult {
  for (const file of files) {
    if (file.fragment.length > 0) {
      throw new BridgeError(
        `${file.file}: the VM has no place for commands outside a function, so a fragment cannot be translated`,
      )
    }
  }

  // Pass one: the table the VM needs and SM does not.
  const arity = new Map<string, number>()
  for (const file of files) {
    for (const fn of file.functions) arity.set(fn.decl.name, fn.decl.args.length)
  }

  const globals = new Map<string, number>()
  const addressOf = (name: string): number => {
    const known = globals.get(name)
    if (known !== undefined) return known
    const address = ADDR.HEAP_TOP - globals.size
    if (address <= ADDR.HEAP_BASE) {
      throw new BridgeError(`out of room for global variables at ${name}`)
    }
    globals.set(name, address)
    return address
  }

  const out = new Map<string, VmCommand[]>()
  const into = (name: string): VmCommand[] => {
    const dot = name.indexOf('.')
    const file = dot < 0 ? 'Main' : name.slice(0, dot)
    const existing = out.get(file)
    if (existing !== undefined) return existing
    const made: VmCommand[] = []
    out.set(file, made)
    return made
  }
  let labels = 0

  for (const file of files) {
    for (const fn of file.functions) {
      const slot = new Map<string, { segment: 'argument' | 'local'; index: number }>()
      fn.decl.args.forEach((n, i) => slot.set(n, { segment: 'argument', index: i }))
      fn.decl.locals.forEach((n, i) => slot.set(n, { segment: 'local', index: i }))

      const pos: VmPos = { file: file.file, line: fn.decl.pos.line }
      const target = into(fn.decl.name)
      target.push({ kind: 'function', name: fn.decl.name, locals: fn.decl.locals.length, pos })

      for (const command of fn.body) {
        const at: VmPos = { file: file.file, line: command.pos.line }
        const emit = (...commands: BareVm[]) => {
          for (const c of commands) target.push({ ...c, pos: at } as VmCommand)
        }
        const local = (name: string) => {
          const where = slot.get(name)
          if (where === undefined) {
            throw new BridgeError(`${file.file}: in line ${command.pos.line}: ${fn.decl.name} does not declare ${name}`)
          }
          return where
        }

        switch (command.kind) {
          case 'pushConst':
            emit({ kind: 'push', segment: 'constant', index: command.value })
            break
          case 'pushLocal': {
            const where = local(command.name)
            emit({ kind: 'push', segment: where.segment, index: where.index })
            break
          }
          case 'popLocal': {
            const where = local(command.name)
            emit({ kind: 'pop', segment: where.segment, index: where.index })
            break
          }
          case 'pushGlobal':
            emit(
              { kind: 'push', segment: 'constant', index: addressOf(command.name) },
              { kind: 'pop', segment: 'pointer', index: 1 },
              { kind: 'push', segment: 'that', index: 0 },
            )
            break
          case 'popGlobal':
            // The value is already on top, so `that` can be set under it.
            emit(
              { kind: 'pop', segment: 'temp', index: SCRATCH },
              { kind: 'push', segment: 'constant', index: addressOf(command.name) },
              { kind: 'pop', segment: 'pointer', index: 1 },
              { kind: 'push', segment: 'temp', index: SCRATCH },
              { kind: 'pop', segment: 'that', index: 0 },
            )
            break
          case 'label':
            emit({ kind: 'label', name: command.name })
            break
          case 'goto':
            emit({ kind: 'goto', name: command.name })
            break
          case 'ifGoto':
            // `?-->` is "the most significant bit is set", which is "less
            // than zero"; `if-goto` is "not zero".
            emit(
              { kind: 'push', segment: 'constant', index: 0 },
              { kind: 'arithmetic', op: 'lt' },
              { kind: 'ifGoto', name: command.name },
            )
            break
          case 'call': {
            const args = arity.get(command.name)
            if (args === undefined) {
              throw new BridgeError(`${file.file}: in line ${command.pos.line}: function ${command.name} not found`)
            }
            emit({ kind: 'call', name: command.name, args })
            break
          }
          case 'return':
            emit({ kind: 'return' })
            break
          case 'op':
            emit(...operation(command, labels++))
            break
        }
      }
    }
  }

  const text: Record<string, string> = {}
  for (const [name, commands] of out) text[name] = printAll(commands)
  return { files: text, globals }
}

function operation(command: Extract<Command, { kind: 'op' }>, _n: number): BareVm[] {
  switch (command.op) {
    case '+': return [{ kind: 'arithmetic', op: 'add' }]
    case '-': return [{ kind: 'arithmetic', op: 'sub' }]
    case '&': return [{ kind: 'arithmetic', op: 'and' }]
    case '|': return [{ kind: 'arithmetic', op: 'or' }]
    case '(-)': return [{ kind: 'arithmetic', op: 'neg' }]
    case '~': return [{ kind: 'arithmetic', op: 'not' }]
    // x - y, which is what SM's `<` leaves, not the VM's all-ones.
    case '<': return [{ kind: 'arithmetic', op: 'sub' }]
    // y - x.
    case '>': return [{ kind: 'arithmetic', op: 'sub' }, { kind: 'arithmetic', op: 'neg' }]
    // ~(v | -v), with v = x - y kept in temp because the VM cannot duplicate.
    case '==': return [
      { kind: 'arithmetic', op: 'sub' },
      { kind: 'pop', segment: 'temp', index: SCRATCH },
      { kind: 'push', segment: 'temp', index: SCRATCH },
      { kind: 'push', segment: 'temp', index: SCRATCH },
      { kind: 'arithmetic', op: 'neg' },
      { kind: 'arithmetic', op: 'or' },
      { kind: 'arithmetic', op: 'not' },
    ]
    case '[]': return [
      { kind: 'pop', segment: 'pointer', index: 1 },
      { kind: 'push', segment: 'that', index: 0 },
    ]
    // The address is the deeper operand and the value is on top (C1).
    case '->[]': return [
      { kind: 'pop', segment: 'temp', index: SCRATCH },
      { kind: 'pop', segment: 'pointer', index: 1 },
      { kind: 'push', segment: 'temp', index: SCRATCH },
      { kind: 'pop', segment: 'that', index: 0 },
    ]
  }
}

function printAll(commands: readonly VmCommand[]): string {
  const lines = commands.map((c) => {
    switch (c.kind) {
      case 'push': return `  push ${c.segment} ${c.index}`
      case 'pop': return `  pop ${c.segment} ${c.index}`
      case 'arithmetic': return `  ${c.op}`
      case 'label': return `label ${c.name}`
      case 'goto': return `  goto ${c.name}`
      case 'ifGoto': return `  if-goto ${c.name}`
      case 'function': return `function ${c.name} ${c.locals}`
      case 'call': return `  call ${c.name} ${c.args}`
      case 'return': return '  return'
    }
  })
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}
