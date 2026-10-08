/**
 * SM to Hack assembly: the reference translator.
 *
 * A port of the supplied `SM_trnsleitor3.py`, instruction for instruction.
 * Its sequences follow the prototype's, because this is the thing a
 * student's own translator is measured against and because the .cmp files are
 * generated from its output. They part company over C2: `SP` names the first
 * free cell here, as it does in the course's VM, where the prototype had it
 * name the top element. A push therefore writes and then increments, a pop
 * decrements and then reads, the frame pointer is `SP - (a+2)`, and the
 * return sets `SP = LCL`.
 *
 * This is a build tool. It is not shipped to students — the assignment is to
 * write it.
 *
 * Note what the translator does *not* need: a function table, or a second
 * pass. A call names the function and nothing else, and the argument count
 * is used only by the callee's own declaration and return. That property is
 * the design's, and keeping it is what makes the assignment tractable.
 */
import type { Command, FunctionDecl, SmFile } from '@sm/core'
import { frameOffsetsOf } from './frame.js'

/** The assembly symbols the runtime occupies. */
export const RUNTIME = {
  /** A global `x` becomes `SM.x`, so no program can name a runtime cell. */
  globalPrefix: 'SM.',
  functionPrefix: 'FUNTION.',
  labelPrefix: 'LABEL.',
  returnPrefix: 'call.',
  scratch: 'tmp',
  endLabel: 'end',
} as const

export interface TranslateOptions {
  /** Comments make the output readable; a comparison turns them off. */
  readonly comments?: boolean
  /**
   * Whether to emit the bootstrap — set `SP`, call `Sys.init`, then loop.
   *
   * The course's scheme, measured across its own test scripts: every project-7
   * script and all but one of project 8's set `RAM[0]` by hand, because the
   * translator at that stage emits no bootstrap and the student has not met
   * one. The single exception is `FibonacciElement`, whose whole subject is
   * the bootstrap. We follow it exactly: a test sets the stack pointer itself
   * unless the bootstrap is what it is testing.
   *
   * A fragment can never have one — there is no `Sys.init` to call.
   */
  readonly bootstrap?: boolean
}

class Writer {
  readonly lines: string[] = []
  constructor(private readonly comments: boolean) {}

  emit(...instructions: string[]): void {
    this.lines.push(...instructions)
  }

  note(text: string): void {
    if (this.comments) this.lines.push(`// ${text}`)
  }
}

/** A points at the top element, which is one below SP. */
const AT_TOP = ['@SP', 'A=M-1']
/** Push whatever is in D: write where SP points, then move it on. */
const PUSH_D = ['@SP', 'M=M+1', 'A=M-1', 'M=D']
/** Pop the top into D. A is left on the cell just vacated. */
const POP_D = ['@SP', 'AM=M-1', 'D=M']
/** After POP_D, step A down to the element now on top. */
const DOWN = ['A=A-1']

function pushConst(value: number | string): string[] {
  return [`@${value}`, 'D=A', ...PUSH_D]
}

function pushSymbol(symbol: string): string[] {
  return [`@${symbol}`, 'D=M', ...PUSH_D]
}

function popSymbol(symbol: string): string[] {
  return [...POP_D, `@${symbol}`, 'M=D']
}

export function translate(files: readonly SmFile[], options: TranslateOptions = {}): string {
  const w = new Writer(options.comments ?? true)
  let callCount = 0

  const call = (name: string): string[] => {
    const label = `${RUNTIME.returnPrefix}${callCount++}`
    return [
      // The caller's LCL, then where to come back to.
      ...pushSymbol('LCL'),
      ...pushConst(label),
      `@${RUNTIME.functionPrefix}${name}`,
      '0;JMP',
      `(${label})`,
    ]
  }

  // A fragment is a bare sequence of commands with no declaration, the
  // teaching form of spec/sm.md section 8.1 used by the first package of
  // exercises. It has no frame and no Sys.init, so it can have no bootstrap.
  const fragment = files.flatMap((f) => f.fragment)
  const wantBootstrap = options.bootstrap ?? true

  if (fragment.length > 0 && options.bootstrap === true) {
    throw new Error('a fragment has no Sys.init to bootstrap into')
  }

  if (fragment.length > 0) {
    const noFrame = { name: '', args: [], locals: [], pos: { file: '', line: 0 } }
    for (const command of fragment) {
      w.note(source(command))
      w.emit(...translateCommand(command, noFrame, new Map(), call))
    }
    // No end loop either: the course's project-7 output simply stops, and its
    // scripts run a fixed number of ticks.
  } else if (wantBootstrap) {
    w.note('bootstrap')
    // C2: SP names the first free cell, so an empty stack is 256.
    w.emit('@256', 'D=A', '@SP', 'M=D')
    w.note('call Sys.init')
    w.emit(...call('Sys.init'))
    w.note('and then loop for ever')
    w.emit(`@${RUNTIME.endLabel}`, `(${RUNTIME.endLabel})`, '0;JMP')
  }

  for (const file of files) {
    for (const fn of file.functions) {
      const offsets = frameOffsetsOf(fn.decl)
      w.note(`! ${fn.decl.name}`)
      w.emit(...declaration(fn.decl))
      for (const command of fn.body) {
        w.note(source(command))
        w.emit(...translateCommand(command, fn.decl, offsets, call))
      }
    }
  }

  return w.lines.join('\n') + '\n'
}

function declaration(decl: FunctionDecl): string[] {
  const out = [
    `(${RUNTIME.functionPrefix}${decl.name})`,
    // LCL = SP - (a+2): below SP sit the return address, the saved LCL and
    // the arguments, so the frame pointer lands on the first argument.
    '@SP', 'D=M', '@LCL', 'M=D',
    `@${decl.args.length + 2}`, 'D=A', '@LCL', 'M=M-D',
  ]
  for (let i = 0; i < decl.locals.length; i++) out.push(...pushConst(0))
  return out
}

function translateCommand(
  command: Command,
  decl: FunctionDecl,
  offsets: ReadonlyMap<string, number>,
  call: (name: string) => string[],
): string[] {
  const label = (name: string) => `${RUNTIME.labelPrefix}${decl.name}.${name}`
  switch (command.kind) {
    case 'pushConst': return pushConst(command.value)
    case 'pushGlobal': return pushSymbol(RUNTIME.globalPrefix + command.name)
    case 'popGlobal': return popSymbol(RUNTIME.globalPrefix + command.name)
    case 'pushLocal':
      return [`@${offset(offsets, command.name)}`, 'D=A', '@LCL', 'A=D+M', 'D=M', ...PUSH_D]
    case 'popLocal':
      // The address is worked out first and parked, because popping needs D.
      return [
        `@${offset(offsets, command.name)}`, 'D=A', '@LCL', 'D=D+M', `@${RUNTIME.scratch}`, 'M=D',
        ...POP_D,
        `@${RUNTIME.scratch}`, 'A=M', 'M=D',
      ]
    case 'op': return operator(command.op)
    case 'label': return [`(${label(command.name)})`]
    case 'goto': return [`@${label(command.name)}`, '0;JMP']
    // True is the most significant bit, which is a jump on negative.
    case 'ifGoto': return [...POP_D, `@${label(command.name)}`, 'D;JLT']
    case 'call': return call(command.name)
    case 'return': return returnSequence(decl.args.length)
  }
}

function offset(offsets: ReadonlyMap<string, number>, name: string): number {
  const at = offsets.get(name)
  if (at === undefined) throw new Error(`no local named ${name}`)
  return at
}

/**
 * The arithmetic. Every comparison is computed rather than branched to,
 * because only the most significant bit carries meaning — which is the whole
 * point of that convention.
 */
function operator(op: string): string[] {
  switch (op) {
    case 'add': return [...POP_D, ...DOWN, 'M=D+M']
    case 'sub': return [...POP_D, ...DOWN, 'M=M-D']
    case 'and': return [...POP_D, ...DOWN, 'M=D&M']
    case 'or': return [...POP_D, ...DOWN, 'M=D|M']
    case 'neg': return [...AT_TOP, 'M=-M']
    case 'not': return [...AT_TOP, 'M=!M']
    // x < y is the sign of x-y; x > y the sign of y-x.
    case 'lt': return [...POP_D, ...DOWN, 'M=M-D']
    case 'gt': return [...POP_D, ...DOWN, 'M=D-M']
    // v | -v has the top bit set for every v but zero, so negating it leaves
    // a true exactly when the two were equal.
    case 'eq': return [...POP_D, ...DOWN, 'M=M-D', 'D=-M', 'M=M|D', 'M=!M']
    case 'push-indirect': return [...AT_TOP, 'A=M', 'D=M', ...AT_TOP, 'M=D']
    // The value is on top and the address below it (C1), so the address is
    // in the cell the pop leaves A one above.
    case 'pop-indirect': return [...POP_D, ...DOWN, 'A=M', 'M=D', '@SP', 'M=M-1']
    default: throw new Error(`unknown operator ${op}`)
  }
}

function returnSequence(args: number): string[] {
  // Read against SP, which is LCL before the push and LCL+1 after it, so the
  // same offset names the saved LCL and then the return address.
  const toFrame = [`@${args}`, 'D=A', '@SP', 'A=D+M']
  return [
    ...popSymbol(RUNTIME.scratch),
    // SP = LCL, so the next push lands on the first argument.
    '@LCL', 'D=M', '@SP', 'M=D',
    ...toFrame, 'D=M', '@LCL', 'M=D',
    ...pushSymbol(RUNTIME.scratch),
    ...toFrame, 'A=M', '0;JMP',
  ]
}

function source(command: Command): string {
  switch (command.kind) {
    case 'pushConst': return `<-${command.value}`
    case 'pushGlobal': return `<-${command.name}`
    case 'pushLocal': return `<-@${command.name}`
    case 'popGlobal': return `->${command.name}`
    case 'popLocal': return `->@${command.name}`
    case 'op': return command.op
    case 'label': return `${command.name}:`
    case 'goto': return `-->${command.name}`
    case 'ifGoto': return `?-->${command.name}`
    case 'call': return command.name
    case 'return': return '<--'
  }
}
