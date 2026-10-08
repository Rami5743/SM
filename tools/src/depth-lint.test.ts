import { parse } from '@sm/core'
import { compileClass, parseClass } from '@sm/jack'
import { lintDepth } from './depth-lint.js'

function lint(...sources: string[]) {
  const files = sources.map((s, i) => {
    const r = parse(`F${i}.sm`, s)
    expect(r.diagnostics.map((d) => d.message)).toEqual([])
    return r.file
  })
  return lintDepth(files).map((p) => `${p.fn}: ${p.message}`)
}

describe('the depth lint', () => {
  it('passes a balanced function', () => {
    expect(lint('function f(a)\npush @a\npush 1\nadd\nreturn')).toEqual([])
  })

  it('passes a balanced loop', () => {
    expect(lint('function f(a) locals t\npush 0\npop @t\nlabel L\npush @t\npush @a\nlt\nnot\nif-goto done\npush @t\npush 1\nadd\npop @t\ngoto L\nlabel done\npush @t\nreturn'))
      .toEqual([])
  })

  // The bug it exists for: a statement call whose value is left behind, in a
  // loop. Legal SM, and invisible until the stack walks into the heap.
  it('catches a loop that grows the stack', () => {
    const problems = lint(
      'function side()\npush 0\nreturn',
      'function f()\nlabel L\ncall side\ngoto L\n',
    )
    expect(problems[0]).toMatch(/different stack depths, 0 and 1/)
  })

  // The defect the supplied Jack compiler really has.
  it('catches a call that pushes an argument the function does not take', () => {
    const problems = lint('function g(n)\npush @n\nreturn', 'function f(n)\npush @n\npush @n\ncall g\nreturn')
    expect(problems[0]).toMatch(/wants exactly one value above the locals, and finds 2/)
  })

  it('catches taking more from the stack than is there', () => {
    expect(lint('function f()\nadd\nreturn')[0]).toMatch(/takes more from the stack/)
  })
})

describe('everything the Jack compiler emits', () => {
  // Running the lint over our own output is the cheapest assurance in the
  // suite, and it is a check on us and on nobody else.
  const CLASSES = [
    'class A { function int f(int n) { var int i, t; let t = 0; let i = 0;' +
    ' while (i < n) { let t = t + i; let i = i + 1; } return t; } }',
    'class B { field int x; constructor B new(int v) { let x = v; return this; }' +
    ' method int get() { return x; } method void bump() { let x = x + 1; return; } }',
    'class C { function void run() { var B b; let b = B.new(1); do b.bump();' +
    ' do b.bump(); return; } }',
    'class D { function int arr(Array a) { let a[0] = 1; let a[1] = a[0] + 1;' +
    ' if (a[1] > 1) { return a[1]; } else { return 0; } } }',
  ]

  it('is balanced', () => {
    const sm = CLASSES.map((c, i) => compileClass(`C${i}.jack`, parseClass(`C${i}.jack`, c)).sm)
    expect(lint(...sm)).toEqual([])
  })
})
