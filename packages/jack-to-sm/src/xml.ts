/**
 * The project 10 XML, printed back out of the tree.
 *
 * This exists for one reason: the course ships three sets of class files with
 * their expected XML, and comparing against them tests our parser with seven
 * files of known-good expected output that we did not have to write and
 * cannot have biased. The grammar is the course's, unchanged, so there is
 * nothing here that a student sees — project 10 carries over intact.
 *
 * It prints from the same tree the compiler walks, not from a second parse.
 * The prototype's two parsers are what made this worth saying.
 */
import type { Call, ClassDec, Expression, Statement, Subroutine, Type, VarDec } from './ast.js'
import { escapeXml, KEYWORDS, type TokenKind } from './token.js'

class Printer {
  private readonly out: string[] = []
  private depth = 0

  private pad(): string {
    return '  '.repeat(this.depth)
  }

  token(kind: TokenKind, text: string): void {
    this.out.push(`${this.pad()}<${kind}> ${escapeXml(text)} </${kind}>`)
  }

  /** A name: `int` and friends are keywords, a class name is an identifier. */
  name(text: string): void {
    this.token(KEYWORDS.has(text) ? 'keyword' : 'identifier', text)
  }

  symbol(text: string): void {
    this.token('symbol', text)
  }

  open(tag: string): void {
    this.out.push(`${this.pad()}<${tag}>`)
    this.depth++
  }

  close(tag: string): void {
    this.depth--
    this.out.push(`${this.pad()}</${tag}>`)
  }

  text(): string {
    return `${this.out.join('\n')}\n`
  }
}

export function classToXml(cls: ClassDec): string {
  const p = new Printer()
  printClass(p, cls)
  return p.text()
}

function printClass(p: Printer, cls: ClassDec): void {
  p.open('class')
  p.token('keyword', 'class')
  p.token('identifier', cls.name)
  p.symbol('{')
  for (const dec of cls.classVars) {
    p.open('classVarDec')
    p.token('keyword', dec.scope)
    printVarDec(p, dec)
    p.close('classVarDec')
  }
  for (const sub of cls.subroutines) printSubroutine(p, sub)
  p.symbol('}')
  p.close('class')
}

/** `<type> a, b, c ;` — whatever keyword introduced it is already printed. */
function printVarDec(p: Printer, dec: VarDec): void {
  printType(p, dec.type)
  dec.names.forEach((n, i) => {
    if (i > 0) p.symbol(',')
    p.token('identifier', n)
  })
  p.symbol(';')
}

function printType(p: Printer, type: Type): void {
  p.name(type)
}

function printSubroutine(p: Printer, sub: Subroutine): void {
  p.open('subroutineDec')
  p.token('keyword', sub.kind)
  printType(p, sub.returns)
  p.token('identifier', sub.name)
  p.symbol('(')
  p.open('parameterList')
  sub.params.forEach((param, i) => {
    if (i > 0) p.symbol(',')
    printType(p, param.type)
    p.token('identifier', param.name)
  })
  p.close('parameterList')
  p.symbol(')')
  p.open('subroutineBody')
  p.symbol('{')
  for (const dec of sub.vars) {
    p.open('varDec')
    p.token('keyword', 'var')
    printVarDec(p, dec)
    p.close('varDec')
  }
  printStatements(p, sub.body)
  p.symbol('}')
  p.close('subroutineBody')
  p.close('subroutineDec')
}

function printStatements(p: Printer, statements: readonly Statement[]): void {
  p.open('statements')
  for (const s of statements) printStatement(p, s)
  p.close('statements')
}

function printStatement(p: Printer, s: Statement): void {
  switch (s.kind) {
    case 'let':
      p.open('letStatement')
      p.token('keyword', 'let')
      p.token('identifier', s.name)
      if (s.index !== undefined) {
        p.symbol('[')
        printExpression(p, s.index)
        p.symbol(']')
      }
      p.symbol('=')
      printExpression(p, s.value)
      p.symbol(';')
      p.close('letStatement')
      return
    case 'if':
      p.open('ifStatement')
      p.token('keyword', 'if')
      p.symbol('(')
      printExpression(p, s.cond)
      p.symbol(')')
      p.symbol('{')
      printStatements(p, s.then)
      p.symbol('}')
      if (s.else !== undefined) {
        p.token('keyword', 'else')
        p.symbol('{')
        printStatements(p, s.else)
        p.symbol('}')
      }
      p.close('ifStatement')
      return
    case 'while':
      p.open('whileStatement')
      p.token('keyword', 'while')
      p.symbol('(')
      printExpression(p, s.cond)
      p.symbol(')')
      p.symbol('{')
      printStatements(p, s.body)
      p.symbol('}')
      p.close('whileStatement')
      return
    case 'do':
      p.open('doStatement')
      p.token('keyword', 'do')
      printCall(p, s.call)
      p.symbol(';')
      p.close('doStatement')
      return
    case 'return':
      p.open('returnStatement')
      p.token('keyword', 'return')
      if (s.value !== undefined) printExpression(p, s.value)
      p.symbol(';')
      p.close('returnStatement')
      return
  }
}

/** A subroutine call has no element of its own: its tokens sit in the term. */
function printCall(p: Printer, call: Call): void {
  if (call.target !== undefined) {
    p.token('identifier', call.target)
    p.symbol('.')
  }
  p.token('identifier', call.name)
  p.symbol('(')
  p.open('expressionList')
  call.args.forEach((a, i) => {
    if (i > 0) p.symbol(',')
    printExpression(p, a)
  })
  p.close('expressionList')
  p.symbol(')')
}

/**
 * Jack's expressions are flat — term op term op term, left to right, no
 * precedence — so the left-nested chain the parser builds flattens back out
 * exactly. Parentheses survive as their own term, which is why the tree
 * keeps them.
 */
function flatten(e: Expression, into: Expression[], ops: string[]): void {
  if (e.kind === 'binary') {
    flatten(e.left, into, ops)
    ops.push(e.op)
    into.push(e.right)
    return
  }
  into.push(e)
}

function printExpression(p: Printer, e: Expression): void {
  const terms: Expression[] = []
  const ops: string[] = []
  flatten(e, terms, ops)
  p.open('expression')
  terms.forEach((t, i) => {
    if (i > 0) p.symbol(ops[i - 1]!)
    printTerm(p, t)
  })
  p.close('expression')
}

function printTerm(p: Printer, e: Expression): void {
  p.open('term')
  switch (e.kind) {
    case 'int': p.token('integerConstant', String(e.value)); break
    case 'string': p.token('stringConstant', e.value); break
    case 'keyword': p.token('keyword', e.value); break
    case 'var': p.token('identifier', e.name); break
    case 'index':
      p.token('identifier', e.name)
      p.symbol('[')
      printExpression(p, e.index)
      p.symbol(']')
      break
    case 'call': printCall(p, e.call); break
    case 'paren':
      p.symbol('(')
      printExpression(p, e.inner)
      p.symbol(')')
      break
    case 'unary':
      p.symbol(e.op)
      printTerm(p, e.operand)
      break
    case 'binary':
      // Unreachable: flatten() never hands a binary node to printTerm.
      printExpression(p, e)
      break
  }
  p.close('term')
}
