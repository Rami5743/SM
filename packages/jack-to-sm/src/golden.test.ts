/**
 * The SM the compiler emits, written out.
 *
 * We own both sides here, so pinning the exact output is legitimate: it is
 * how an unintended change in code generation is noticed, and it is the
 * clearest statement of what each construct costs. It is also exactly what
 * we must never ask of a student — their translator's output is checked by
 * what it computes, never by its text.
 */
import { compileClass } from './compile.js'
import { parseClass } from './parse.js'

function sm(jack: string): string[] {
  return compileClass('G.jack', parseClass('G.jack', jack)).sm.trimEnd().split('\n')
}

/** One subroutine, with its declaration line dropped. */
function body(subroutine: string): string[] {
  return sm(`class G { ${subroutine} }`).slice(1)
}

describe('the shape of a frame', () => {
  it('a function takes what it is given and declares what it keeps', () => {
    expect(sm('class G { function int f(int a, int b) { var int t; return a; } }')[0])
      .toBe('function G.f(a, b) locals t')
  })

  it('a method takes the receiver as its first argument', () => {
    expect(sm('class G { method int f(int a) { return a; } }')[0]).toBe('function G.f(this, a)')
  })

  it('a constructor keeps the object in an internal variable', () => {
    expect(sm('class G { field int x; constructor G new() { return this; } }').slice(0, 5))
      .toEqual(['function G.new() locals this', 'push 1', 'call Memory.alloc', 'pop @this', 'push @this'])
  })
})

describe('the four kinds of name', () => {
  it('an argument and an internal variable are the same instruction', () => {
    expect(body('function void f(int a) { var int t; let t = a; return; }')
      .slice(0, 2)).toEqual(['push @a', 'pop @t'])
  })

  it('a static is a global named for its class', () => {
    expect(sm('class G { static int n; function void f() { let n = 1; return; } }').slice(1, 3))
      .toEqual(['push 1', 'pop G.n'])
  })

  // The whole of the `pointer`/`this`/`that` machinery, in three
  // instructions over an ordinary address.
  it('a field is a peek through this', () => {
    expect(sm('class G { field int x, y; method int f() { return y; } }').slice(1, 5))
      .toEqual(['push @this', 'push 1', 'add', 'push-indirect'])
  })

  it('a field is written with a poke, and needs no temporary', () => {
    expect(sm('class G { field int x; method void f() { let x = 7; return; } }').slice(1, 6))
      .toEqual(['push @this', 'push 0', 'add', 'push 7', 'pop-indirect'])
  })
})

describe('arrays', () => {
  // C1 is what makes this possible: `->[]` takes the address first and the
  // value second, so both sides can be evaluated left to right onto the
  // stack and nothing has to be held anywhere else.
  it('a[i] = b[j] needs no temporary', () => {
    expect(body('function void f(Array a, Array b) { let a[1] = b[2]; return; }'))
      .toEqual(['push @a', 'push 1', 'add', 'push @b', 'push 2', 'add', 'push-indirect', 'pop-indirect', 'push 0', 'return'])
  })
})

describe('operators', () => {
  it('stay symbolic, and multiplication is a call', () => {
    expect(body('function void f() { var int t; let t = ((1 + 2) - 3) * 4; return; }'))
      .toEqual([
        'push 1', 'push 2', 'add', 'push 3', 'sub', 'push 4', 'call Math.multiply', 'pop @t', 'push 0', 'return',
      ])
  })

  it('true is every bit set, which is what the branch tests', () => {
    expect(body('function void f() { var boolean t; let t = true; return; }').slice(0, 3))
      .toEqual(['push 1', 'neg', 'pop @t'])
  })

  it('= is ==, because = is assignment', () => {
    expect(body('function void f() { var boolean t; let t = (1 = 2); return; }').slice(0, 4))
      .toEqual(['push 1', 'push 2', 'eq', 'pop @t'])
  })
})

describe('control', () => {
  it('an if jumps over the then-part when the condition is false', () => {
    expect(body('function void f(int a) { if (a > 0) { let a = 1; } else { let a = 2; } return; }'))
      .toEqual([
        'push @a', 'push 0', 'gt', 'not', 'if-goto else.0',
        'push 1', 'pop @a',
        'goto endif.0', 'label else.0',
        'push 2', 'pop @a',
        'label endif.0',
        'push 0', 'return',
      ])
  })

  it('a while tests at the top', () => {
    expect(body('function void f(boolean a) { while (a) { let a = false; } return; }'))
      .toEqual([
        'label while.0', 'push @a', 'not', 'if-goto endwhile.0',
        'push 0', 'pop @a',
        'goto while.0', 'label endwhile.0',
        'push 0', 'return',
      ])
  })
})

describe('calls', () => {
  it('a do statement discards the value every SM function returns', () => {
    expect(body('function void f() { do G.g(); return; }')).toEqual(['call G.g', 'pop Sys.discard', 'push 0', 'return'])
  })

  it('a method call passes the object first', () => {
    expect(body('function void f(Array a) { do a.dispose(); return; }'))
      .toEqual(['push @a', 'call Array.dispose', 'pop Sys.discard', 'push 0', 'return'])
  })

  it('a return with no value returns zero, because every function returns one', () => {
    expect(body('function void f() { return; }')).toEqual(['push 0', 'return'])
  })

  it('a string constant is built a character at a time', () => {
    expect(body('function void f() { do G.g("hi"); return; }')).toEqual([
      'push 2', 'call String.new',
      'push 104', 'call String.appendChar',
      'push 105', 'call String.appendChar',
      'call G.g', 'pop Sys.discard', 'push 0', 'return',
    ])
  })
})
