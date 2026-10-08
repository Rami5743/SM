import { parse, cleanLine } from './parse.js'
import { printFile } from './print.js'
import { resolve } from './resolve.js'
import type { SmFile } from './ast.js'

function parseOk(source: string, file = 'T.sm'): SmFile {
  const r = parse(file, source)
  expect(r.diagnostics.map((d) => d.message)).toEqual([])
  return r.file
}

function kinds(source: string): string[] {
  const f = parseOk(source)
  const cmds = [...f.fragment, ...f.functions.flatMap((fn) => fn.body)]
  return cmds.map((c) => c.kind)
}

describe('cleanLine', () => {
  it('removes a comment', () => {
    expect(cleanLine('add // add them')).toBe('add')
  })

  it('removes the space at either end, and leaves the space between', () => {
    expect(cleanLine('\t push  @x  ')).toBe('push  @x')
  })
})

describe('parse', () => {
  it('reads one of every command', () => {
    const all = [
      'function sin(x, y) locals m, n',
      'add', 'sub', 'and', 'or', 'neg', 'not', 'gt', 'lt', 'eq',
      'push-indirect', 'pop-indirect',
      'return',
      'push 7', 'push @x', 'push a', 'pop @n', 'pop b',
      'label loop', 'goto loop', 'if-goto loop',
      'call sin',
    ].join('\n')
    const r = parse('all.sm', all)
    expect(r.diagnostics).toEqual([])
    expect(r.file.functions).toHaveLength(1)
    expect(r.file.functions[0]!.decl).toMatchObject({
      name: 'sin', args: ['x', 'y'], locals: ['m', 'n'],
    })
    // Every command is accounted for, and printing gives the text back.
    expect(printFile(r.file).trimEnd().split('\n')).toEqual(all.split('\n'))
  })

  it('tells a local from a global', () => {
    expect(kinds('push @x\npush x\npop @x\npop x')).toEqual([
      'pushLocal', 'pushGlobal', 'popLocal', 'popGlobal',
    ])
  })

  it('tells a conditional jump from an unconditional one', () => {
    expect(kinds('if-goto L\ngoto L')).toEqual(['ifGoto', 'goto'])
  })

  it('ignores the space around the punctuation of a declaration', () => {
    const f = parseOk('function f ( a , b ) locals c , d\nreturn')
    expect(f.functions[0]!.decl).toMatchObject({ name: 'f', args: ['a', 'b'], locals: ['c', 'd'] })
  })

  it('keeps commands before any declaration as a fragment', () => {
    const f = parseOk('push 7\npush 8\nadd')
    expect(f.fragment).toHaveLength(3)
    expect(f.functions).toHaveLength(0)
  })

  it('splits a file into functions at each declaration', () => {
    const f = parseOk('function a()\nreturn\nfunction b()\nreturn')
    expect(f.functions.map((fn) => fn.decl.name)).toEqual(['a', 'b'])
    expect(f.functions.every((fn) => fn.body.length === 1)).toBe(true)
  })
})

describe('parse diagnostics', () => {
  function errs(source: string): string[] {
    return parse('T.sm', source).diagnostics.map((d) => d.message)
  }

  // CORRECTIONS C3: a line nobody recognises is a mistake, not a call to a
  // function nobody declared.
  it('rejects a line that is no command', () => {
    expect(errs('wobble')).toEqual(['"wobble" is not a command'])
  })

  it('says so when a command is written in capitals', () => {
    expect(errs('PUSH 5')).toEqual(['a command is written in lower case: `push`'])
  })

  it('rejects a command with no operand', () => {
    expect(errs('push')).toEqual(['`push` takes one operand, and was given 0'])
    expect(errs('goto')).toEqual(['`goto` takes one operand, and was given 0'])
  })

  it('rejects an operand on a command that takes none', () => {
    expect(errs('add 1')).toEqual(['`add` takes no operand'])
    expect(errs('return 0')).toEqual(['`return` takes no operand'])
  })

  it('rejects two operands', () => {
    expect(errs('push 1 2')).toEqual(['`push` takes one operand, and was given 2'])
  })

  it('rejects a constant where a variable belongs', () => {
    expect(errs('pop 5')).toEqual(['`pop` needs a variable to pop into, not a constant'])
  })

  it('rejects a declaration it cannot read', () => {
    expect(errs('function f')).toEqual(['a function is declared `function f(a, b) locals t, u`'])
  })

  // CORRECTIONS C5.
  it('rejects a signed constant', () => {
    expect(errs('push -5')[0]).toMatch(/may not carry a sign/)
  })

  it('rejects a constant above 32767', () => {
    expect(errs('push 32768')[0]).toMatch(/above the largest constant/)
  })

  it('accepts the largest constant', () => {
    expect(errs('push 32767')).toEqual([])
  })

  // CORRECTIONS C8: the supplied samples use underscores, Jack allows them and
  // Hack allows them, so the documented letters-digits-dots rule cannot stand.
  it.each(['fib_nam', 'while_strt.1', '_x', 'a.b_c9'])('accepts the symbol %s', (name) => {
    expect(errs(`function f() locals ${name}\npush @${name}\nreturn`)).toEqual([])
  })

  // A leading digit stays excluded: it is how `push 5` is told from `push x`.
  it('rejects a name beginning with a digit', () => {
    expect(errs('push 9lives')[0]).toMatch(/is not a decimal constant/)
  })

  it('names the line', () => {
    const d = parse('T.sm', 'add\nadd\nwobble').diagnostics[0]!
    expect(d.pos).toEqual({ file: 'T.sm', line: 3 })
  })
})

describe('resolve', () => {
  function errs(...sources: Array<[string, string]>): string[] {
    const files = sources.map(([name, src]) => parse(name, src).file)
    return resolve({ files }).map((d) => d.message)
  }

  it('accepts a well-formed program', () => {
    expect(errs(['A.sm', 'function f()\npush 1\nreturn'], ['B.sm', 'function g()\ncall f\nreturn']))
      .toEqual([])
  })

  // The three the course performs, measured on its VM emulator.
  it('rejects a call to a function nobody declares', () => {
    expect(errs(['A.sm', 'function f()\ncall Nope.missing\nreturn']))
      .toEqual(['function Nope.missing not found'])
  })

  it('rejects a jump to a label the function does not declare', () => {
    expect(errs(['A.sm', 'function f()\ngoto Nowhere\nreturn'])).toEqual(['unknown label - f$Nowhere'])
  })

  it('rejects two functions with the same name, across files', () => {
    expect(errs(['A.sm', 'function f()\nreturn'], ['B.sm', 'function f()\nreturn'])[0])
      .toBe('function f already exists, declared in A.sm')
  })

  // The two that go beyond the course.
  it('rejects a label declared twice in one function', () => {
    expect(errs(['A.sm', 'function f()\nlabel L\nlabel L\nreturn']))
      .toEqual(['label L already exists in function f'])
  })

  it('rejects a local the function does not declare', () => {
    expect(errs(['A.sm', 'function f()\npush @this\nreturn'])).toEqual(['f has no local named this'])
  })

  it('rejects an argument and an internal variable sharing a name', () => {
    expect(errs(['A.sm', 'function f(x) locals x\nreturn'])).toEqual(['f declares x twice'])
  })

  // A global and a function may share a name; they are written differently
  // where they are used (spec/sm.md section 4).
  it('lets a global and a function share a name', () => {
    expect(errs(['A.sm', 'function f()\npush f\npop f\ncall f\nreturn'])).toEqual([])
  })

  it('lets a label and a variable share a name', () => {
    expect(errs(['A.sm', 'function f(x)\nlabel x\npush @x\ngoto x\nreturn'])).toEqual([])
  })

  it('lets two functions use the same label name', () => {
    expect(errs(['A.sm', 'function f()\nlabel L\ngoto L\nfunction g()\nlabel L\ngoto L'])).toEqual([])
  })
})
