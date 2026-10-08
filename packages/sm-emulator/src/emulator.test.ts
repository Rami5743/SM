import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asCurrent, parse, resolve, type SmFile } from '@sm/core'
import { Emulator, SmFault, binary } from './emulator.js'
import { ADDR } from './memory.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../..')

function files(...sources: Array<[string, string]>): SmFile[] {
  return sources.map(([name, src]) => {
    const r = parse(name, src)
    expect(r.diagnostics.map((d) => d.message)).toEqual([])
    return r.file
  })
}

/** Run a fragment: a bare sequence of commands, the teaching form. */
function fragment(src: string): Emulator {
  const e = new Emulator()
  e.load(files(['T.sm', src]), { allowFragment: true })
  e.run(10000)
  return e
}

/** Run a whole program and return it stopped. */
function program(...sources: Array<[string, string]>): Emulator {
  const parsed = files(...sources)
  expect(resolve({ files: parsed }).map((d) => d.message)).toEqual([])
  const e = new Emulator()
  e.load(parsed)
  e.run(200000)
  return e
}

describe('the stack', () => {
  // CORRECTIONS C2: `SP` names the first free cell, as the course's VM does.
  // An empty stack is 256, and the first value pushed lands there.
  it('starts empty at 256', () => {
    const e = new Emulator()
    e.load(files(['T.sm', 'push 7']), { allowFragment: true })
    expect(e.memory.get(ADDR.SP)).toBe(256)
  })

  it('puts the first value at 256 and moves SP past it', () => {
    const e = fragment('push 7')
    expect(e.memory.get(256)).toBe(7)
    expect(e.memory.get(ADDR.SP)).toBe(257)
  })

  it('zeroes all of RAM at reset', () => {
    const e = new Emulator()
    e.memory.set(5000, 42)
    e.load(files(['T.sm', 'push 1']), { allowFragment: true })
    expect(e.memory.get(5000)).toBe(0)
  })
})

describe('arithmetic', () => {
  it.each([
    ['push 7\npush 8\nadd', 15],
    ['push 7\npush 8\nsub', -1],
    ['push 7\nneg', -7],
    ['push 12\npush 10\nand', 8],
    ['push 12\npush 10\nor', 14],
  ])('%s leaves %i', (src, want) => {
    expect(fragment(src).stack()).toEqual([want])
  })

  it('wraps at sixteen bits', () => {
    expect(fragment('push 32767\npush 1\nadd').stack()).toEqual([-32768])
  })
})

describe('the boolean convention', () => {
  // Only the most significant bit carries meaning, so a test is "is this
  // negative" (spec/sm.md section 5).
  const isTrue = (src: string) => fragment(src).stack()[0]! < 0

  it.each([
    ['push 3\npush 5\nlt', true],
    ['push 5\npush 3\nlt', false],
    ['push 5\npush 5\nlt', false],
    ['push 5\npush 3\ngt', true],
    ['push 3\npush 5\ngt', false],
    ['push 5\npush 5\neq', true],
    ['push 5\npush 4\neq', false],
  ])('%s is %s', (src, want) => {
    expect(isTrue(src)).toBe(want)
  })

  it('negates with ~, which inverts the significant bit', () => {
    expect(isTrue('push 5\npush 5\neq\nnot')).toBe(false)
    expect(isTrue('push 5\npush 4\neq\nnot')).toBe(true)
  })

  // The emulator must leave the same word the assembly would, not merely the
  // same truth bit, because a .cmp file compares cells.
  it('leaves the difference, as the assembly does', () => {
    expect(binary('lt', 3, 5)).toBe(-2)
    expect(binary('gt', 3, 5)).toBe(2)
    expect(binary('eq', 5, 5)).toBe(-1)
  })
})

describe('memory commands', () => {
  // CORRECTIONS C1: the address is the deeper operand, the value on top.
  it('stores the value at the address', () => {
    const e = fragment('push 3000\npush 42\npop-indirect')
    expect(e.memory.get(3000)).toBe(42)
    expect(e.stack()).toEqual([])
  })

  it('reads back what it stored', () => {
    expect(fragment('push 3000\npush 42\npop-indirect\npush 3000\npush-indirect').stack()).toEqual([42])
  })
})

describe('functions', () => {
  it('runs Sys.init and stops when it returns', () => {
    const e = program(['Sys.sm', 'function Sys.init()\npush 0\nreturn'])
    expect(e.done).toBe(true)
  })

  it('passes arguments and returns a value', () => {
    const e = program(
      ['Sys.sm', 'function Sys.init()\npush 20\npush 22\ncall add2\npop answer\npush 0\nreturn'],
      ['A.sm', 'function add2(a, b)\npush @a\npush @b\nadd\nreturn'],
    )
    const address = e.globals().get('answer')!
    expect(e.memory.get(address)).toBe(42)
  })

  it('gives internal variables a value of zero', () => {
    const e = program(['Sys.sm', 'function Sys.init() locals z\npush @z\npop seen\npush 0\nreturn'])
    expect(e.memory.get(e.globals().get('seen')!)).toBe(0)
  })

  it('keeps a caller frame alive across a call', () => {
    const e = program(
      ['Sys.sm', 'function Sys.init() locals t\npush 7\npop @t\npush 1\ncall noisy\npop junk\npush @t\npop kept\npush 0\nreturn'],
      ['A.sm', 'function noisy(n) locals u, v\npush 5\npop @u\npush 6\npop @v\npush @n\nreturn'],
    )
    expect(e.memory.get(e.globals().get('kept')!)).toBe(7)
  })

  it('recurses', () => {
    const e = program(
      ['Sys.sm', 'function Sys.init()\npush 6\ncall fib\npop f6\npush 0\nreturn'],
      ['F.sm', [
        'function fib(n)',
        'push @n', 'push 2', 'lt', 'if-goto base',
        'push @n', 'push 1', 'sub', 'call fib',
        'push @n', 'push 2', 'sub', 'call fib',
        'add', 'return',
        'label base', 'push @n', 'return',
      ].join('\n')],
    )
    expect(e.memory.get(e.globals().get('f6')!)).toBe(8)
  })

  // `return` removes everything above the locals, so a value left behind in
  // straight-line code is swept (spec/sm.md section 3.3).
  it('sweeps what a function leaves above its locals', () => {
    const e = program(
      ['Sys.sm', 'function Sys.init()\npush 1\ncall messy\npop r\npush 0\nreturn'],
      ['A.sm', 'function messy(n)\npush 99\npush 98\npush @n\nreturn'],
    )
    expect(e.memory.get(e.globals().get('r')!)).toBe(1)
    // What is left is Sys.init's own returned value, in the bootstrap's frame.
    expect(e.stack()).toEqual([0])
  })
})

describe('faults', () => {
  // The runtime half of CORRECTIONS C6, worded as the course words it.
  it('reports control reaching the end of a function', () => {
    const e = new Emulator()
    e.load(files(['Sys.sm', 'function Sys.init()\npush 1\ncall falls\npop r\npush 0\nreturn'], ['A.sm', 'function falls(n)\npush @n']))
    expect(() => e.run(1000)).toThrow(/Missing return in falls/)
  })

  it('does not report it for a function nobody calls', () => {
    const e = program(['Sys.sm', 'function Sys.init()\npush 0\nreturn'], ['A.sm', 'function falls(n)\npush @n'])
    expect(e.done).toBe(true)
  })

  // Q9 declined: a loop that grows the stack is legal SM and runs until the
  // stack actually overflows, which the course reports the same way.
  it('lets the stack grow until it overflows, then names the function', () => {
    const e = new Emulator()
    e.load(files(['Sys.sm', 'function Sys.init()\nlabel L\npush 7\ngoto L']))
    expect(() => e.run(10000)).toThrow(/Stack overflow in Sys.init/)
  })

  // Where exactly the boundary is, since the convention decides it: 2047 is
  // the last usable cell, so a stack of 1792 values fills it and the next
  // push is the overflow.
  it('fills the stack to 2047 and faults on the push after it', () => {
    const e = fragment('push 7\n'.repeat(1792))
    expect(e.memory.get(ADDR.SP)).toBe(2048)
    expect(e.memory.get(2047)).toBe(7)
    expect(e.stack().length).toBe(1792)

    const over = new Emulator()
    over.load(files(['T.sm', 'push 7\n'.repeat(1793)]), { allowFragment: true })
    expect(() => over.run(10000)).toThrow(/Stack overflow/)
  })

  it('refuses a fragment unless one was asked for', () => {
    const e = new Emulator()
    expect(() => e.load(files(['T.sm', 'push 7']))).toThrow(SmFault)
  })

  it('refuses a program with no Sys.init', () => {
    const e = new Emulator()
    expect(() => e.load(files(['A.sm', 'function f()\nreturn']))).toThrow(/no Sys.init/)
  })
})

describe('the frame chain', () => {
  it('walks from the innermost frame out to Sys.init', () => {
    const e = new Emulator()
    e.load(files(
      ['Sys.sm', 'function Sys.init()\npush 1\ncall outer\npop r\npush 0\nreturn'],
      ['A.sm', 'function outer(n)\npush @n\ncall inner\nreturn'],
      ['B.sm', 'function inner(n)\nlabel here\npush @n\nreturn'],
    ))
    // Step until the innermost function is entered.
    for (let i = 0; i < 50 && !e.frames().some((f) => f.fn === 'inner'); i++) e.step()
    expect(e.frames().map((f) => f.fn)).toEqual(['inner', 'outer', 'Sys.init'])
  })
})

describe('FibonacciElement, the supplied sample', () => {
  it('computes the sixth Fibonacci number', () => {
    const dir = join(root, 'reference/samples/FibonacciElement_sm')
    const main = parse('Main.sm', asCurrent(readFileSync(join(dir, 'Main.sm'), 'utf8'))).file
    // The supplied Sys.sm loops forever; ours returns, so the run can end.
    const sys = parse('Sys.sm', 'function Sys.init()\npush 6\ncall Main.fibonacci\npop result\npush 0\nreturn').file
    expect(resolve({ files: [main, sys] })).toEqual([])
    const e = new Emulator()
    e.load([main, sys])
    e.run(200000)
    expect(e.done).toBe(true)
    expect(e.memory.get(e.globals().get('result')!)).toBe(8)
  })
})

describe('the devices', () => {
  // Nothing about them is special to SM: a program reaches them with the
  // ordinary memory commands.
  it('shows a pixel a program wrote', () => {
    // 16384 is the first screen word; bit 0 is the pixel at (0, 0).
    const e = fragment('push 16384\npush 1\npop-indirect')
    expect(e.pixel(0, 0)).toBe(true)
    expect(e.pixel(1, 0)).toBe(false)
  })

  it('places a pixel by row and column', () => {
    // Row 2, column 17: word 16384 + 2*32 + 1, bit 1.
    const e = fragment('push 16449\npush 2\npop-indirect')
    expect(e.pixel(17, 2)).toBe(true)
  })

  it('lets a program read the key', () => {
    const e = new Emulator()
    e.load(files(['T.sm', 'push 24576\npush-indirect\npop pressed']), { allowFragment: true })
    e.setKey(81)
    e.run(100)
    expect(e.memory.get(e.globals().get('pressed')!)).toBe(81)
  })
})

describe('a frame planted by a test script', () => {
  /**
   * How the course tests a function before the bootstrap exists: the script
   * builds the frame, and the function's code, being first, simply runs.
   *
   * An SM frame is a saved pointer and a return address where the course's is
   * four pointers and a return address, and LCL is derived from SP rather than
   * set, so the script plants four cells where the course's plants twelve.
   */
  it('runs a function with no Sys.init and leaves the result in the first argument slot', () => {
    const parsed = files(['A.sm', 'function twice(n)\npush @n\npush @n\nadd\nreturn'])
    const e = new Emulator()
    // No bootstrap: the program is the function, so reset would look for a
    // Sys.init. Load it as a fragmentless program and plant the frame.
    e.load(parsed, { entry: 'none' })
    e.memory.set(310, 21)       // the argument
    e.memory.set(311, 0)        // the caller's LCL
    e.memory.set(312, 9999)     // a return address outside the program
    e.memory.set(ADDR.SP, 313)  // one past the frame, which is where SP sits
    e.run(1000)

    expect(e.memory.get(310)).toBe(42)
    expect(e.memory.get(ADDR.SP)).toBe(311)
  })
})
