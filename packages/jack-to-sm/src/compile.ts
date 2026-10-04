/**
 * Jack to SM.
 *
 * What SM changes is the target, not the language, so the grammar and the
 * rules are the course's. Two of its checks come with them (C6): an
 * unqualified call is a method call and is an error inside a `function`, and
 * control must not be able to reach the end of a subroutine without a
 * `return`. The supplied prototype performs neither, and its own sample trips
 * both.
 *
 * Where the design shows: a field is reached with `[]` and `->[]` over an
 * ordinary address on the stack, so there is no `this` segment to point and
 * no `that` to re-point. `a[i] = b[j]` needs no temporary.
 */
import type { Call, ClassDec, Expression, Statement, Subroutine } from './ast.js'
import { fields, statics } from './ast.js'
import { completes, firstUnreachable } from './flow.js'
import { JackError } from './token.js'

type Scope = 'static' | 'field' | 'arg' | 'var'

interface Symbol_ {
  readonly scope: Scope
  readonly type: string
  /** Fields are numbered from the object's base; the rest are named. */
  readonly index: number
}

export interface CompileResult {
  readonly sm: string
  readonly warnings: readonly string[]
}

/** The SM global that a `do` statement's discarded value goes to. */
const DISCARD = 'Sys.discard'

export function compileClass(file: string, cls: ClassDec): CompileResult {
  return new Compiler(file, cls).run()
}

class Compiler {
  private readonly out: string[] = []
  private readonly warnings: string[] = []
  private readonly classScope = new Map<string, Symbol_>()
  private locals = new Map<string, Symbol_>()
  private current!: Subroutine
  private labels = 0

  constructor(private readonly file: string, private readonly cls: ClassDec) {
    let fieldIndex = 0
    for (const dec of statics(cls)) {
      for (const name of dec.names) {
        this.classScope.set(name, { scope: 'static', type: dec.type, index: 0 })
      }
    }
    for (const dec of fields(cls)) {
      for (const name of dec.names) {
        this.classScope.set(name, { scope: 'field', type: dec.type, index: fieldIndex++ })
      }
    }
  }

  private get fieldCount(): number {
    return fields(this.cls).reduce((n, d) => n + d.names.length, 0)
  }

  private fail(line: number, message: string): never {
    throw new JackError(this.file, line, message)
  }

  private emit(...lines: string[]): void {
    this.out.push(...lines)
  }

  run(): CompileResult {
    for (const sub of this.cls.subroutines) this.subroutine(sub)
    return { sm: this.out.join('\n') + '\n', warnings: this.warnings }
  }

  private lookup(name: string): Symbol_ | undefined {
    return this.locals.get(name) ?? this.classScope.get(name)
  }

  private subroutine(sub: Subroutine): void {
    this.current = sub
    this.locals = new Map()

    // A method receives the object as its first argument; a constructor
    // makes one and keeps it in a local of the same name. Either way `this`
    // is an ordinary variable here, which is the point.
    const args: string[] = []
    if (sub.kind === 'method') {
      this.locals.set('this', { scope: 'arg', type: this.cls.name, index: 0 })
      args.push('this')
    }
    for (const p of sub.params) {
      if (this.locals.has(p.name)) this.fail(sub.line, `${sub.name} declares ${p.name} twice`)
      this.locals.set(p.name, { scope: 'arg', type: p.type, index: args.length })
      args.push(p.name)
    }

    const vars: string[] = []
    if (sub.kind === 'constructor') {
      this.locals.set('this', { scope: 'var', type: this.cls.name, index: 0 })
      vars.push('this')
    }
    for (const dec of sub.vars) {
      for (const name of dec.names) {
        if (this.locals.has(name)) this.fail(dec.line, `${sub.name} declares ${name} twice`)
        this.locals.set(name, { scope: 'var', type: dec.type, index: vars.length })
        vars.push(name)
      }
    }

    // C6, the static half: reject rather than insert a return.
    if (completes(sub.body)) {
      this.fail(sub.line, `In subroutine ${sub.name}: Program flow may reach end of subroutine without 'return'`)
    }
    const dead = firstUnreachable(sub.body)
    if (dead !== undefined) {
      this.warnings.push(`In ${this.file} (line ${dead.line}): In subroutine ${sub.name}: Warning: Unreachable code`)
    }

    this.emit(`!${this.cls.name}.${sub.name}(${args.join(',')})${vars.join(',')}`)
    if (sub.kind === 'constructor') {
      // Memory.alloc returns the base address; it is an ordinary value.
      this.emit(`<-${this.fieldCount}`, 'Memory.alloc', '->@this')
    }
    this.statements(sub.body)
  }

  private statements(list: readonly Statement[]): void {
    for (const s of list) this.statement(s)
  }

  private statement(s: Statement): void {
    switch (s.kind) {
      case 'let': return this.let_(s)
      case 'if': return this.if_(s)
      case 'while': return this.while_(s)
      case 'do':
        this.call(s.call)
        // Every SM function returns a value; a statement call must remove it.
        // Where it goes is this compiler's own business (Q4).
        this.emit(`->${DISCARD}`)
        return
      case 'return':
        if (s.value === undefined) this.emit('<-0')
        else this.expression(s.value)
        this.emit('<--')
        return
    }
  }

  /**
   * `let a[i] = e` pushes the address and then the value, left to right, with
   * no temporary — the order C1 settles and the reason it is the right one.
   */
  private let_(s: Extract<Statement, { kind: 'let' }>): void {
    const symbol = this.lookup(s.name)
    if (symbol === undefined) this.fail(s.line, `${s.name} is not declared`)

    if (s.index !== undefined) {
      this.read(s.name, symbol, s.line)
      this.expression(s.index)
      this.emit('+')
      this.expression(s.value)
      this.emit('->[]')
      return
    }

    if (symbol.scope === 'field') {
      this.pushThis(s.line)
      this.emit(`<-${symbol.index}`, '+')
      this.expression(s.value)
      this.emit('->[]')
      return
    }
    this.expression(s.value)
    this.emit(this.write(s.name, symbol))
  }

  private if_(s: Extract<Statement, { kind: 'if' }>): void {
    const n = this.labels++
    this.expression(s.cond)
    this.emit('~', `?-->else.${n}`)
    this.statements(s.then)
    this.emit(`-->endif.${n}`, `else.${n}:`)
    if (s.else !== undefined) this.statements(s.else)
    this.emit(`endif.${n}:`)
  }

  private while_(s: Extract<Statement, { kind: 'while' }>): void {
    const n = this.labels++
    this.emit(`while.${n}:`)
    this.expression(s.cond)
    this.emit('~', `?-->endwhile.${n}`)
    this.statements(s.body)
    this.emit(`-->while.${n}`, `endwhile.${n}:`)
  }

  private expression(e: Expression): void {
    switch (e.kind) {
      case 'int': this.emit(`<-${e.value}`); return
      case 'keyword':
        switch (e.value) {
          // True is every bit set, which has the significant bit set.
          case 'true': this.emit('<-1', '(-)'); return
          case 'false':
          case 'null': this.emit('<-0'); return
          case 'this': this.pushThis(e.line); return
        }
        return
      case 'string': {
        this.emit(`<-${e.value.length}`, 'String.new')
        for (const ch of e.value) this.emit(`<-${ch.codePointAt(0)}`, 'String.appendChar')
        return
      }
      case 'var': {
        const symbol = this.lookup(e.name)
        if (symbol === undefined) this.fail(e.line, `${e.name} is not declared`)
        this.read(e.name, symbol, e.line)
        return
      }
      case 'index': {
        const symbol = this.lookup(e.name)
        if (symbol === undefined) this.fail(e.line, `${e.name} is not declared`)
        this.read(e.name, symbol, e.line)
        this.expression(e.index)
        this.emit('+', '[]')
        return
      }
      case 'call': this.call(e.call); return
      case 'paren': this.expression(e.inner); return
      case 'unary':
        this.expression(e.operand)
        this.emit(e.op === '-' ? '(-)' : '~')
        return
      case 'binary':
        this.expression(e.left)
        this.expression(e.right)
        this.emit(...binary(e.op, e.line, this.file))
        return
    }
  }

  /** Push the value of a variable. A field is a peek through `this`. */
  private read(name: string, symbol: Symbol_, line: number): void {
    switch (symbol.scope) {
      case 'static': this.emit(`<-${this.cls.name}.${name}`); return
      case 'arg':
      case 'var': this.emit(`<-@${name}`); return
      case 'field':
        this.pushThis(line)
        this.emit(`<-${symbol.index}`, '+', '[]')
        return
    }
  }

  private write(name: string, symbol: Symbol_): string {
    switch (symbol.scope) {
      case 'static': return `->${this.cls.name}.${name}`
      case 'arg':
      case 'var': return `->@${name}`
      case 'field': throw new Error('a field is written with ->[], not a pop')
    }
  }

  private pushThis(line: number): void {
    if (!this.locals.has('this')) {
      this.fail(line, `In subroutine ${this.current.name}: there is no 'this' in a function`)
    }
    this.emit('<-@this')
  }

  private call(c: Call): void {
    if (c.target === undefined) {
      // C6, the other half: an unqualified call is a method call, so it has
      // to pass a receiver — which a `function` does not have. The supplied
      // compiler emits `<-@this` regardless, and so compiles its own sample
      // into a call that pushes an argument the function does not take.
      if (this.current.kind === 'function' || this.current.kind === 'constructor') {
        if (this.current.kind === 'function') {
          this.fail(c.line, `In subroutine ${this.current.name}: Subroutine ${this.cls.name}.${c.name} called as a method from within a function`)
        }
      }
      this.pushThis(c.line)
      for (const a of c.args) this.expression(a)
      this.emit(`${this.cls.name}.${c.name}`)
      return
    }

    const symbol = this.lookup(c.target)
    if (symbol !== undefined) {
      // A method on an object held in a variable.
      this.read(c.target, symbol, c.line)
      for (const a of c.args) this.expression(a)
      this.emit(`${symbol.type}.${c.name}`)
      return
    }
    // A function or constructor of a named class.
    for (const a of c.args) this.expression(a)
    this.emit(`${c.target}.${c.name}`)
  }
}

function binary(op: string, line: number, file: string): string[] {
  switch (op) {
    case '+': return ['+']
    case '-': return ['-']
    case '&': return ['&']
    case '|': return ['|']
    case '<': return ['<']
    case '>': return ['>']
    case '=': return ['==']
    case '*': return ['Math.multiply']
    case '/': return ['Math.divide']
    default: throw new JackError(file, line, `${op} is not an operator`)
  }
}
