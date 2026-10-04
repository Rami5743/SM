/**
 * The SM emulator.
 *
 * The RAM layout is the one a translated program would produce, cell for
 * cell, because the .cmp files of the student packages have to be satisfied
 * both by this and by the course's CPU emulator running the student's own
 * .asm. So the arithmetic here reproduces the assembly's exact values and not
 * merely its truth bits — `<` leaves x-y on the stack, not a canonical -1.
 */
import type { Command, SmFile } from '@sm/core'
import { ADDR, Memory, toWord } from './memory.js'
import { link, NO_FUNCTION, type Program, type Step } from './program.js'
import { standardLibrary, withLibrary } from './library.js'

export class SmFault extends Error {
  constructor(message: string, readonly where: string | undefined) {
    super(where === undefined ? message : `${message} in ${where}`)
    this.name = 'SmFault'
  }
}

export interface Frame {
  readonly fn: string
  readonly lcl: number
}

export type RunState = 'running' | 'halted'

/** Where a program may start. */
export interface LoadOptions {
  /**
   * A fragment is a bare sequence of commands with no declaration, the
   * teaching form of spec/sm.md section 8.1. Off unless asked for, so that a
   * missing `Sys.init` is reported rather than silently tolerated.
   */
  readonly allowFragment?: boolean
  /**
   * Where to begin. `'bootstrap'`, the default, sets `SP` and calls
   * `Sys.init` as a translated program does.
   *
   * `'none'` starts at the first step with nothing set up, which is how a
   * test runs a function before the bootstrap exists: the script plants the
   * frame itself and the function's code, being first, simply runs. The
   * course does the same, and its own project-8 scripts rely on it.
   */
  readonly entry?: 'bootstrap' | 'none'
  /**
   * Link the standard library: the OS classes the program reaches and does
   * not define itself, as `library.ts` explains. A compiled Jack program
   * needs it; a hand-written SM program of projects 7 and 8 must not have
   * it, or the library's `Sys.init` would supplant the program's.
   */
  readonly library?: boolean
}

export class Emulator {
  readonly memory = new Memory()
  private program: Program = link([])
  private pc = 0
  private state: RunState = 'halted'
  private fragmentMode = false
  /** Set when `Sys.init` returns, which is where the bootstrap's call lands. */
  private finished = false
  steps = 0

  load(files: readonly SmFile[], options: LoadOptions = {}): void {
    const all = options.library === true
      ? withLibrary(files, standardLibrary(), {
          seed: options.entry === 'none' ? [] : ['Sys.init'],
        })
      : files
    this.program = link(all)
    this.reset(options)
  }

  reset(options: LoadOptions = {}): void {
    this.memory.reset()
    this.steps = 0
    this.finished = false
    this.fragmentMode = false

    // The bootstrap: SP = 255, so an empty stack is 255 and the first value
    // pushed lands at 256 (CORRECTIONS C2).
    this.memory.set(ADDR.SP, ADDR.STACK_BASE - 1)

    if (this.program.fragmentEnd > 0) {
      if (options.allowFragment !== true) {
        throw new SmFault('commands outside any function; a fragment must be asked for', undefined)
      }
      this.fragmentMode = true
      this.pc = 0
      this.state = 'running'
      return
    }

    if (options.entry === 'none') {
      // Nothing is set up: the script plants what it needs.
      this.pc = 0
      this.state = 'running'
      return
    }

    const init = this.program.byName.get('Sys.init')
    if (init === undefined) {
      throw new SmFault('no Sys.init to start from', undefined)
    }
    // An ordinary call, with no exception to it (spec/sm.md 8.2). The caller's
    // LCL is pushed before the return address; LCL is zero at reset, which is
    // what makes the cell reproducible.
    this.push(this.memory.get(ADDR.LCL))
    this.push(RETURN_TO_BOOTSTRAP)
    this.pc = this.program.functions[init]!.entry
    this.state = 'running'
  }

  get running(): boolean {
    return this.state === 'running'
  }

  get done(): boolean {
    return this.finished
  }

  /** The stack, deepest first. */
  stack(): number[] {
    const sp = this.memory.get(ADDR.SP)
    const out: number[] = []
    for (let a = ADDR.STACK_BASE; a <= sp; a++) out.push(this.memory.get(a))
    return out
  }

  /**
   * The chain of frames, innermost first, walked through the saved LCL in
   * each. Stops at the frame whose return address is the bootstrap's.
   */
  frames(): Frame[] {
    if (this.fragmentMode) return []
    const out: Frame[] = []
    let lcl = this.memory.get(ADDR.LCL)
    let fn = this.currentFunction()
    // The innermost frame is not built until its `enter` step has run.
    if (this.program.steps[this.pc]?.kind === 'enter') return out
    for (let guard = 0; guard < 1024; guard++) {
      if (fn === undefined) break
      if (lcl < ADDR.STACK_BASE || lcl > ADDR.STACK_TOP) break
      out.push({ fn: fn.name, lcl })
      const a = fn.args.length
      const ret = this.memory.get(lcl + a + 1)
      if (ret === RETURN_TO_BOOTSTRAP) break
      const step = this.program.steps[ret]
      if (step === undefined || step.fn === NO_FUNCTION) break
      lcl = this.memory.get(lcl + a)
      fn = this.program.functions[step.fn]!.decl
    }
    return out
  }

  /** The function the program counter is in, if it is in one. */
  at(): string | undefined {
    return this.currentFunction()?.name
  }

  /** The linked program, which with `library` on is more than was loaded. */
  get linked(): Program {
    return this.program
  }

  private currentFunction() {
    const step = this.program.steps[this.pc]
    if (step === undefined || step.fn === NO_FUNCTION) return undefined
    return this.program.functions[step.fn]!.decl
  }

  private where(): string | undefined {
    return this.currentFunction()?.name
  }

  private push(value: number): void {
    const sp = this.memory.get(ADDR.SP) + 1
    if (sp > ADDR.STACK_TOP) {
      throw new SmFault('Stack overflow', this.where())
    }
    this.memory.set(ADDR.SP, sp)
    this.memory.set(sp, value)
  }

  private pop(): number {
    const sp = this.memory.get(ADDR.SP)
    if (sp < ADDR.STACK_BASE) {
      throw new SmFault('Stack underflow', this.where())
    }
    const value = this.memory.get(sp)
    this.memory.set(ADDR.SP, sp - 1)
    return value
  }

  /** Execute one step. Returns false once the program has stopped. */
  step(): boolean {
    if (this.state !== 'running') return false
    const step = this.program.steps[this.pc]
    if (step === undefined) {
      // Only a fragment can run out of steps without returning.
      if (!this.fragmentMode) throw new SmFault('ran past the end of the program', this.where())
      this.state = 'halted'
      this.finished = true
      return false
    }
    this.steps++
    if (step.kind === 'enter') this.enter(step)
    else this.exec(step.command, step)
    return this.state === 'running'
  }

  run(maxSteps: number): void {
    for (let i = 0; i < maxSteps && this.state === 'running'; i++) this.step()
  }

  private enter(step: Extract<Step, { kind: 'enter' }>): void {
    // LCL = SP - (a+1), then one zero per internal variable.
    const a = step.decl.args.length
    this.memory.set(ADDR.LCL, this.memory.get(ADDR.SP) - (a + 1))
    for (let i = 0; i < step.decl.locals.length; i++) this.push(0)
    this.advance()
  }

  /**
   * Move to the next step. Crossing into another function this way is control
   * falling off the end of this one, which is the runtime half of C6; the
   * course reports the same thing, `Missing return in Foo.a`.
   */
  private advance(): void {
    const here = this.program.steps[this.pc]!
    if (here.fn === NO_FUNCTION) {
      // A fragment runs to the end of its own steps and then stops.
      this.pc++
      if (this.pc >= this.program.fragmentEnd) {
        this.state = 'halted'
        this.finished = true
      }
      return
    }
    const next = this.program.steps[this.pc + 1]
    if (next === undefined || next.fn !== here.fn) {
      throw new SmFault('Missing return', this.program.functions[here.fn]!.decl.name)
    }
    this.pc++
  }

  private jump(target: number): void {
    this.pc = target
  }

  private exec(command: Command, step: Step): void {
    const fn = step.fn === NO_FUNCTION ? undefined : this.program.functions[step.fn]
    switch (command.kind) {
      case 'pushConst': this.push(command.value); return this.advance()
      case 'pushGlobal': this.push(this.global(command.name)); return this.advance()
      case 'popGlobal': this.setGlobal(command.name, this.pop()); return this.advance()
      case 'pushLocal': this.push(this.memory.get(this.localAddress(command.name, fn))); return this.advance()
      case 'popLocal': {
        const address = this.localAddress(command.name, fn)
        this.memory.set(address, this.pop())
        return this.advance()
      }
      case 'op': return this.operate(command.op)
      case 'label': return this.advance()
      case 'goto': return this.jump(this.labelTarget(command.name, step))
      case 'ifGoto': {
        const value = this.pop()
        // True is the most significant bit set, which in a signed word is
        // simply a negative value (spec/sm.md section 5).
        if (value < 0) return this.jump(this.labelTarget(command.name, step))
        return this.advance()
      }
      case 'call': return this.call(command.name)
      case 'return': return this.doReturn(step)
    }
  }

  private operate(op: string): void {
    switch (op) {
      case '(-)': this.push(toWord(-this.pop())); break
      case '~': this.push(toWord(~this.pop())); break
      case '[]': this.push(this.memory.get(this.address(this.pop()))); break
      case '->[]': {
        // The value is on top and the address below it (CORRECTIONS C1).
        const value = this.pop()
        const address = this.pop()
        this.memory.set(this.address(address), value)
        break
      }
      default: {
        const y = this.pop()
        const x = this.pop()
        this.push(binary(op, x, y))
      }
    }
    this.advance()
  }

  private address(value: number): number {
    // A 16-bit word is signed here; an address is the same bits unsigned.
    return value & 0xffff
  }

  private labelTarget(name: string, step: Step): number {
    const where = step.fn === NO_FUNCTION ? '<fragment>' : this.program.functions[step.fn]!.decl.name
    const target = step.fn === NO_FUNCTION ? undefined : this.program.labels[step.fn]?.get(name)
    if (target === undefined) throw new SmFault(`unknown label - ${where}$${name}`, undefined)
    return target
  }

  private call(name: string): void {
    const index = this.program.byName.get(name)
    if (index === undefined) throw new SmFault(`function ${name} not found`, undefined)
    // The caller's LCL, then the step to come back to.
    this.push(this.memory.get(ADDR.LCL))
    this.push(this.pc + 1)
    this.jump(this.program.functions[index]!.entry)
  }

  private doReturn(step: Step): void {
    if (step.fn === NO_FUNCTION) throw new SmFault('`<--` outside any function', undefined)
    const decl = this.program.functions[step.fn]!.decl
    const a = decl.args.length
    const value = this.pop()
    const lcl = this.memory.get(ADDR.LCL)
    const callerLcl = this.memory.get(lcl + a)
    const ret = this.memory.get(lcl + a + 1)

    // Everything from LCL upward goes, whatever was left above the locals.
    this.memory.set(ADDR.SP, lcl - 1)
    this.memory.set(ADDR.LCL, callerLcl)
    this.push(value)

    if (ret === RETURN_TO_BOOTSTRAP) {
      this.state = 'halted'
      this.finished = true
      return
    }
    // A return address that is not a step of this program stops the run.
    //
    // This is what lets a test plant a frame by hand and call a function
    // without a bootstrap, which is how the course tests a function before
    // the student has written one: its SimpleFunction.tst plants a return
    // address of 1000, and the Hack CPU then wanders harmlessly through
    // unassembled ROM until the tick budget runs out. Here the same plant
    // stops cleanly, so that both emulators end with the same RAM.
    if (this.program.steps[ret] === undefined) {
      this.state = 'halted'
      this.finished = true
      return
    }
    this.jump(ret)
  }

  private localAddress(name: string, fn: { offsets: ReadonlyMap<string, number> } | undefined): number {
    const offset = fn?.offsets.get(name)
    if (offset === undefined) throw new SmFault(`no local named ${name}`, this.where())
    return this.memory.get(ADDR.LCL) + offset
  }

  // Globals are named cells. The addresses are handed out from the first
  // register the runtime does not reserve, in the order the names are met,
  // which is what the Hack assembler does with a symbol it has not seen.
  private readonly globalAddresses = new Map<string, number>()

  private globalAddress(name: string): number {
    const known = this.globalAddresses.get(name)
    if (known !== undefined) return known
    const address = ADDR.STATIC_BASE + this.globalAddresses.size
    if (address > ADDR.STATIC_TOP) {
      throw new SmFault(`out of room for global variables at ${name}`, this.where())
    }
    this.globalAddresses.set(name, address)
    return address
  }

  private global(name: string): number {
    return this.memory.get(this.globalAddress(name))
  }

  private setGlobal(name: string, value: number): void {
    this.memory.set(this.globalAddress(name), value)
  }

  /** Where each global ended up, for a RAM view. */
  globals(): ReadonlyMap<string, number> {
    return this.globalAddresses
  }

  // The memory-mapped devices. Nothing about them is special to SM: a program
  // reaches them with `[]` and `->[]` like any other address. They are here
  // because the Jack library drives them, and because a screen that can be
  // read back turns "it looks right" into something a test can assert.

  /** The screen as it stands: 256 rows of 32 words, one bit per pixel. */
  screen(): Int16Array {
    return this.memory.slice(ADDR.SCREEN_BASE, ADDR.SCREEN_TOP + 1)
  }

  /** Is the pixel at (x, y) on? */
  pixel(x: number, y: number): boolean {
    if (x < 0 || x >= 512 || y < 0 || y >= 256) return false
    const word = this.memory.get(ADDR.SCREEN_BASE + y * 32 + (x >> 4))
    return ((word >> (x & 15)) & 1) === 1
  }

  /**
   * The key the program sees, as the course maps them: 0 for none, otherwise
   * the character's code, with 128 and up for the named keys.
   */
  setKey(code: number): void {
    this.memory.set(ADDR.KEYBOARD, code)
  }

  getKey(): number {
    return this.memory.get(ADDR.KEYBOARD)
  }
}

/** A return address no step has, marking the bootstrap's frame. */
const RETURN_TO_BOOTSTRAP = -1

/**
 * The two-operand commands, reproducing the assembly's exact results rather
 * than only their truth bits. `<` is a subtraction, `>` the reverse one, and
 * `==` is `!(v | -v)` over the difference — which is how the supplied
 * translator computes them without a label or a jump.
 */
export function binary(op: string, x: number, y: number): number {
  switch (op) {
    case '+': return toWord(x + y)
    case '-': return toWord(x - y)
    case '&': return toWord(x & y)
    case '|': return toWord(x | y)
    case '<': return toWord(x - y)
    case '>': return toWord(y - x)
    case '==': {
      const v = toWord(x - y)
      return toWord(~(v | toWord(-v)))
    }
    default: throw new SmFault(`unknown operator ${op}`, undefined)
  }
}
