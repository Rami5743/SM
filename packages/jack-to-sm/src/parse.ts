/**
 * The Jack parser: one tree, with a line on every node.
 *
 * The supplied prototype parses Jack twice — once to emit XML and once,
 * separately, to emit SM — so its grammar is written out twice and the two
 * have drifted apart (`parser.py` tests for `"fild"` where the compiler
 * correctly tests for `"field"`, and so has not parsed a class with fields
 * for some time). One tree, used by both, is the fix.
 */
import type { Call, ClassDec, ClassVarDec, Expression, Statement, Subroutine, Type, VarDec } from './ast.js'
import { JackError, tokenize, type Token } from './token.js'

const BINARY_OPS = new Set(['+', '-', '*', '/', '&', '|', '<', '>', '='])

export function parseClass(file: string, source: string): ClassDec {
  return new Parser(file, tokenize(file, source)).classDec()
}

class Parser {
  private at = 0
  constructor(private readonly file: string, private readonly tokens: readonly Token[]) {}

  private peek(ahead = 0): Token | undefined {
    return this.tokens[this.at + ahead]
  }

  private get line(): number {
    return this.peek()?.line ?? this.tokens[this.tokens.length - 1]?.line ?? 1
  }

  private fail(message: string): never {
    throw new JackError(this.file, this.line, message)
  }

  private next(): Token {
    const t = this.tokens[this.at]
    if (t === undefined) this.fail('the file ends in the middle of a class')
    this.at++
    return t
  }

  private eat(text: string): Token {
    const t = this.next()
    if (t.text !== text) this.fail(`expected ${JSON.stringify(text)}, found ${JSON.stringify(t.text)}`)
    return t
  }

  private at_(text: string): boolean {
    return this.peek()?.text === text
  }

  private identifier(what: string): string {
    const t = this.next()
    if (t.kind !== 'identifier') this.fail(`expected ${what}, found ${JSON.stringify(t.text)}`)
    return t.text
  }

  private type(): Type {
    const t = this.next()
    if (t.kind === 'identifier') return t.text
    if (['int', 'char', 'boolean', 'void'].includes(t.text)) return t.text
    this.fail(`expected a type, found ${JSON.stringify(t.text)}`)
  }

  classDec(): ClassDec {
    const line = this.line
    this.eat('class')
    const name = this.identifier('a class name')
    this.eat('{')
    const classVars: ClassVarDec[] = []
    while (this.at_('static') || this.at_('field')) {
      const scope = this.next().text as 'static' | 'field'
      classVars.push({ scope, ...this.varNames() })
    }
    const subroutines: Subroutine[] = []
    while (!this.at_('}')) subroutines.push(this.subroutine())
    this.eat('}')
    return { name, classVars, subroutines, line }
  }

  /** `<type> a, b, c ;` — the keyword before it has already been eaten. */
  private varNames(): VarDec {
    const line = this.line
    const type = this.type()
    const names = [this.identifier('a variable name')]
    while (this.at_(',')) { this.eat(','); names.push(this.identifier('a variable name')) }
    this.eat(';')
    return { type, names, line }
  }

  private subroutine(): Subroutine {
    const line = this.line
    const kindToken = this.next().text
    if (kindToken !== 'constructor' && kindToken !== 'function' && kindToken !== 'method') {
      this.fail(`expected constructor, function or method, found ${JSON.stringify(kindToken)}`)
    }
    const returns = this.type()
    const name = this.identifier('a subroutine name')
    this.eat('(')
    const params: Array<{ type: Type; name: string }> = []
    if (!this.at_(')')) {
      for (;;) {
        const type = this.type()
        params.push({ type, name: this.identifier('a parameter name') })
        if (!this.at_(',')) break
        this.eat(',')
      }
    }
    this.eat(')')
    this.eat('{')
    const vars: VarDec[] = []
    while (this.at_('var')) { this.eat('var'); vars.push(this.varNames()) }
    const body = this.statements()
    this.eat('}')
    return { kind: kindToken, returns, name, params, vars, body, line }
  }

  private statements(): Statement[] {
    const out: Statement[] = []
    while (!this.at_('}')) out.push(this.statement())
    return out
  }

  private statement(): Statement {
    const line = this.line
    switch (this.peek()?.text) {
      case 'let': {
        this.eat('let')
        const name = this.identifier('a variable name')
        let index: Expression | undefined
        if (this.at_('[')) { this.eat('['); index = this.expression(); this.eat(']') }
        this.eat('=')
        const value = this.expression()
        this.eat(';')
        return index === undefined
          ? { kind: 'let', name, value, line }
          : { kind: 'let', name, index, value, line }
      }
      case 'if': {
        this.eat('if'); this.eat('(')
        const cond = this.expression()
        this.eat(')'); this.eat('{')
        const then = this.statements()
        this.eat('}')
        if (!this.at_('else')) return { kind: 'if', cond, then, line }
        this.eat('else'); this.eat('{')
        const otherwise = this.statements()
        this.eat('}')
        return { kind: 'if', cond, then, else: otherwise, line }
      }
      case 'while': {
        this.eat('while'); this.eat('(')
        const cond = this.expression()
        this.eat(')'); this.eat('{')
        const body = this.statements()
        this.eat('}')
        return { kind: 'while', cond, body, line }
      }
      case 'do': {
        this.eat('do')
        const call = this.call()
        this.eat(';')
        return { kind: 'do', call, line }
      }
      case 'return': {
        this.eat('return')
        const value = this.at_(';') ? undefined : this.expression()
        this.eat(';')
        return value === undefined ? { kind: 'return', line } : { kind: 'return', value, line }
      }
      default:
        this.fail(`${JSON.stringify(this.peek()?.text ?? '')} does not begin a statement`)
    }
  }

  private call(): Call {
    const line = this.line
    const first = this.identifier('a subroutine or variable name')
    if (this.at_('.')) {
      this.eat('.')
      const name = this.identifier('a subroutine name')
      return { target: first, name, args: this.args(), line }
    }
    return { name: first, args: this.args(), line }
  }

  private args(): Expression[] {
    this.eat('(')
    const args: Expression[] = []
    if (!this.at_(')')) {
      args.push(this.expression())
      while (this.at_(',')) { this.eat(','); args.push(this.expression()) }
    }
    this.eat(')')
    return args
  }

  /**
   * Jack's expressions are flat: term op term op term, evaluated left to
   * right with no precedence. That is the language's own rule, not a
   * simplification.
   */
  private expression(): Expression {
    let left = this.term()
    while (this.peek()?.kind === 'symbol' && BINARY_OPS.has(this.peek()!.text)) {
      const op = this.next().text
      const right = this.term()
      left = { kind: 'binary', op, left, right, line: left.line }
    }
    return left
  }

  private term(): Expression {
    const line = this.line
    const t = this.peek()
    if (t === undefined) this.fail('the file ends in the middle of an expression')

    if (t.kind === 'integerConstant') { this.next(); return { kind: 'int', value: Number(t.text), line } }
    if (t.kind === 'stringConstant') { this.next(); return { kind: 'string', value: t.text, line } }
    if (t.text === 'true' || t.text === 'false' || t.text === 'null' || t.text === 'this') {
      this.next()
      return { kind: 'keyword', value: t.text, line }
    }
    if (t.text === '(') {
      this.eat('(')
      const inner = this.expression()
      this.eat(')')
      return { kind: 'paren', inner, line }
    }
    if (t.text === '-' || t.text === '~') {
      this.next()
      return { kind: 'unary', op: t.text, operand: this.term(), line }
    }
    if (t.kind === 'identifier') {
      const after = this.peek(1)?.text
      if (after === '(' || after === '.') return { kind: 'call', call: this.call(), line }
      const name = this.identifier('a variable name')
      if (this.at_('[')) {
        this.eat('[')
        const index = this.expression()
        this.eat(']')
        return { kind: 'index', name, index, line }
      }
      return { kind: 'var', name, line }
    }
    this.fail(`${JSON.stringify(t.text)} does not begin a term`)
  }
}
