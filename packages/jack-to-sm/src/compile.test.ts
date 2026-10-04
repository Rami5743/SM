import { parse, resolve } from '@sm/core'
import { Emulator } from '@sm/emulator'
import { compileClass } from './compile.js'
import { parseClass } from './parse.js'
import { JackError, tokenize, tokensToXml } from './token.js'

function compile(source: string, file = 'Main.jack'): string {
  return compileClass(file, parseClass(file, source)).sm
}

/** Compile these classes, add a Sys.init that stores a result, and run. */
function runJack(classes: readonly string[], expression: string): number {
  const sm = classes.map((c) => compile(c, 'C.jack')).join('')
  const sys = `!Sys.init()\n${expression}\n->result\n<-0\n<--\n`
  const files = [parse('C.sm', sm), parse('Sys.sm', sys)].map((r) => {
    expect(r.diagnostics.map((d) => `${d.pos.file}:${d.pos.line} ${d.message}`)).toEqual([])
    return r.file
  })
  // A discard global is written but never read; declare nothing for it.
  expect(resolve({ files }).map((d) => d.message)).toEqual([])
  const e = new Emulator()
  e.load(files)
  e.run(500_000)
  expect(e.done).toBe(true)
  return e.memory.get(e.globals().get('result')!)
}

describe('the tokenizer', () => {
  it('carries a line on every token, which is what lets a message point', () => {
    const tokens = tokenize('T.jack', 'class A {\n\n  function void f() { return; }\n}')
    expect(tokens.find((t) => t.text === 'function')?.line).toBe(3)
  })

  it('emits the project 10 XML, with the course\'s own element names', () => {
    const xml = tokensToXml(tokenize('T.jack', 'let x = 1 < 2;'))
    expect(xml).toContain('<keyword> let </keyword>')
    expect(xml).toContain('<identifier> x </identifier>')
    expect(xml).toContain('<integerConstant> 1 </integerConstant>')
    // The supplied tokenizer writes integrConstant and StringConstant, which
    // the course's compare files do not match.
    expect(xml).not.toContain('integrConstant')
    expect(xml).toContain('<symbol> &lt; </symbol>')
  })

  it('names the line of an unterminated comment', () => {
    expect(() => tokenize('T.jack', 'class A {\n/* never closed\n')).toThrow(/line 2/)
  })
})

describe('the checks the course performs', () => {
  // C6, measured on the official compiler across eleven subroutines.
  it.each([
    ['a do statement and no return', 'function void f() { do Main.g(); }', false],
    ['a let and no return', 'function int f() { var int x; let x = 1; }', false],
    ['if and else both returning', 'function int f(int n) { if (n > 0) { return 1; } else { return 2; } }', true],
    ['an if with no else', 'function int f(int n) { if (n > 0) { return 1; } }', false],
    ['an else that is empty', 'function int f(int n) { if (n > 0) { return 1; } else { } }', false],
    ['while (true) with a return inside', 'function int f() { while (true) { return 1; } }', true],
    // The course's analysis does not look at the condition, so this is
    // accepted although it plainly falls through. We inherit that on purpose.
    ['while (false) with a return inside', 'function int f() { while (false) { return 1; } }', true],
    ['an empty while and nothing after', 'function int f() { while (true) { } }', false],
    ['a while whose body does not return', 'function int f(int n) { while (n > 0) { do Main.g(); } }', false],
  ])('%s is %s', (_name, body, accepted) => {
    const source = `class Main { ${body} function void g() { return; } }`
    if (accepted) expect(() => compile(source)).not.toThrow()
    else expect(() => compile(source)).toThrow(/without 'return'/)
  })

  it('warns about unreachable code without failing', () => {
    const r = compileClass('Main.jack', parseClass('Main.jack',
      'class Main { function int f() { var int x; return 1; let x = 2; } }'))
    expect(r.warnings[0]).toContain('Unreachable code')
  })

  // The defect the supplied compiler has, which its own sample trips.
  it('rejects an unqualified call inside a function', () => {
    expect(() => compile(
      'class Main { function int fib(int n) { return fib(n); } }',
    )).toThrow(/called as a method from within a function/)
  })

  it('allows an unqualified call inside a method', () => {
    expect(() => compile(
      'class Main { field int v; method int a() { return b(); } method int b() { return v; } }',
    )).not.toThrow()
  })
})

describe('what it emits', () => {
  it('never pushes a receiver a function does not have', () => {
    const sm = compile('class Main { function int f(int n) { return Main.f(n); } }')
    expect(sm).not.toContain('<-@this')
  })

  it('writes an array element with the address below the value, and no temporary', () => {
    const sm = compile(
      'class Main { function void f(Array a, Array b) { let a[1] = b[2]; return; } }',
    )
    // address of a[1], then the value of b[2], then the store.
    expect(sm).toContain(['<-@a', '<-1', '+', '<-@b', '<-2', '+', '[]', '->[]'].join('\n'))
  })

  it('reaches a field through this, with no segment to point', () => {
    const sm = compile('class P { field int x; method int get() { return x; } }')
    expect(sm).toContain(['<-@this', '<-0', '+', '[]'].join('\n'))
  })

  it('gives a static the class\'s name, which is how the dotted convention arises', () => {
    const sm = compile('class P { static int n; function void f() { let n = 1; return; } }')
    expect(sm).toContain('->P.n')
  })

  it('declares a method\'s receiver as its first argument', () => {
    expect(compile('class P { method int f(int a) { return a; } }')).toContain('!P.f(this,a)')
  })
})

describe('running what it emits', () => {
  it('computes with functions and arguments', () => {
    expect(runJack(
      ['class C { function int add(int a, int b) { return a + b; } }'],
      '<-20\n<-22\nC.add',
    )).toBe(42)
  })

  it('runs a while loop', () => {
    expect(runJack(
      ['class C { function int sum(int n) { var int i, t; let i = 1; let t = 0;' +
       ' while (~(i > n)) { let t = t + i; let i = i + 1; } return t; } }'],
      '<-6\nC.sum',
    )).toBe(21)
  })

  it('runs an if with both branches', () => {
    expect(runJack(
      ['class C { function int pick(int n) { if (n > 0) { return 10; } else { return 20; } } }'],
      '<-5\nC.pick',
    )).toBe(10)
  })

  it('recurses', () => {
    expect(runJack(
      ['class C { function int fib(int n) { if (n < 2) { return n; }' +
       ' return C.fib(n - 1) + C.fib(n - 2); } }'],
      '<-6\nC.fib',
    )).toBe(8)
  })

  it('reads and writes an array in the heap', () => {
    expect(runJack(
      ['class C { function int go(Array a) { let a[0] = 11; let a[1] = 31;' +
       ' return a[0] + a[1]; } }'],
      '<-3000\nC.go',
    )).toBe(42)
  })

  it('handles true, false and null as the convention says', () => {
    expect(runJack(['class C { function int t() { if (true) { return 1; } return 0; } }'], 'C.t')).toBe(1)
    expect(runJack(['class C { function int f() { if (false) { return 1; } return 0; } }'], 'C.f')).toBe(0)
  })

  it('discards a statement call\'s value rather than leaving it', () => {
    // The stack must come back to where it was, which is what the depth lint
    // checks over every function this compiler emits.
    expect(runJack(
      ['class C { function int go() { do C.side(); do C.side(); return 7; }' +
       ' function int side() { return 1; } }'],
      'C.go',
    )).toBe(7)
  })
})
