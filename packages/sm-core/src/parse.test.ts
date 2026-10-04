import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, cleanLine } from './parse.js'
import { printFile } from './print.js'
import { resolve } from './resolve.js'
import type { SmFile } from './ast.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../..')

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
    expect(cleanLine('+ // add them')).toBe('+')
  })

  // The language says spaces and tabs go before the line is read, so no
  // command has a whitespace rule of its own (spec/sm.md 1.2).
  it.each([
    ['? --> loop', '?-->loop'],
    ['\t<-  @x  ', '<-@x'],
    ['! f ( a , b ) c', '!f(a,b)c'],
  ])('removes all whitespace from %j', (raw, want) => {
    expect(cleanLine(raw)).toBe(want)
  })
})

describe('parse', () => {
  it('reads every command of all_cmds.sm', () => {
    const src = readFileSync(join(root, 'reference/tst/all_cmds.sm'), 'utf8')
    const r = parse('all_cmds.sm', src)
    expect(r.diagnostics).toEqual([])
    expect(r.file.functions).toHaveLength(1)
    expect(r.file.functions[0]!.decl).toMatchObject({
      name: 'sin', args: ['x', 'y'], locals: ['m', 'n'],
    })
  })

  it('tells `<--` from a push', () => {
    expect(kinds('<--')).toEqual(['return'])
  })

  it('tells a local from a global', () => {
    expect(kinds('<-@x\n<-x\n->@x\n->x')).toEqual([
      'pushLocal', 'pushGlobal', 'popLocal', 'popGlobal',
    ])
  })

  it('tells `?-->` from `-->`', () => {
    expect(kinds('?-->L\n-->L')).toEqual(['ifGoto', 'goto'])
  })

  it('reads a bare name as a call', () => {
    expect(kinds('Main.fibonacci')).toEqual(['call'])
  })

  it('keeps commands before any declaration as a fragment', () => {
    const f = parseOk('<-7\n<-8\n+')
    expect(f.fragment).toHaveLength(3)
    expect(f.functions).toHaveLength(0)
  })

  it('splits a file into functions at each declaration', () => {
    const f = parseOk('!a()\n<--\n!b()\n<--')
    expect(f.functions.map((fn) => fn.decl.name)).toEqual(['a', 'b'])
    expect(f.functions.every((fn) => fn.body.length === 1)).toBe(true)
  })
})

describe('parse diagnostics', () => {
  function errs(source: string): string[] {
    return parse('T.sm', source).diagnostics.map((d) => d.message)
  }

  // CORRECTIONS C3: the single `=` must not fall through the catch-all and
  // become a call to a function nobody declared.
  it('rejects `=`', () => {
    expect(errs('=')).toEqual(['the equality command is `==`, not `=`'])
  })

  // CORRECTIONS C5.
  it('rejects a bare `<-`', () => {
    expect(errs('<-')).toEqual(['`<-` needs something to push'])
  })

  it('rejects a bare `->`', () => {
    expect(errs('->')).toEqual(['`->` needs somewhere to pop to'])
  })

  it('rejects a signed constant', () => {
    expect(errs('<--5')[0]).toMatch(/may not carry a sign/)
  })

  it('rejects a constant above 32767', () => {
    expect(errs('<-32768')[0]).toMatch(/above the largest constant/)
  })

  it('accepts the largest constant', () => {
    expect(errs('<-32767')).toEqual([])
  })

  // CORRECTIONS C8: the supplied samples use underscores, Jack allows them and
  // Hack allows them, so the documented letters-digits-dots rule cannot stand.
  it.each(['fib_nam', 'while_strt.1', '_x', 'a.b_c9'])('accepts the symbol %s', (name) => {
    expect(errs(`!f()${name}\n<-@${name}\n<--`)).toEqual([])
  })

  // A leading digit stays excluded: it is how `<-5` is told from `<-x`.
  it('rejects a name beginning with a digit', () => {
    expect(errs('<-9lives')[0]).toMatch(/is not a decimal constant/)
  })

  it('names the line', () => {
    const d = parse('T.sm', '+\n+\n=').diagnostics[0]!
    expect(d.pos).toEqual({ file: 'T.sm', line: 3 })
  })
})

describe('resolve', () => {
  function errs(...sources: Array<[string, string]>): string[] {
    const files = sources.map(([name, src]) => parse(name, src).file)
    return resolve({ files }).map((d) => d.message)
  }

  it('accepts a well-formed program', () => {
    expect(errs(['A.sm', '!f()\n<-1\n<--'], ['B.sm', '!g()\nf\n<--'])).toEqual([])
  })

  // The three the course performs, measured on its VM emulator.
  it('rejects a call to a function nobody declares', () => {
    expect(errs(['A.sm', '!f()\nNope.missing\n<--'])).toEqual(['function Nope.missing not found'])
  })

  it('rejects a jump to a label the function does not declare', () => {
    expect(errs(['A.sm', '!f()\n-->Nowhere\n<--'])).toEqual(['unknown label - f$Nowhere'])
  })

  it('rejects two functions with the same name, across files', () => {
    expect(errs(['A.sm', '!f()\n<--'], ['B.sm', '!f()\n<--'])[0])
      .toBe('function f already exists, declared in A.sm')
  })

  // The two that go beyond the course.
  it('rejects a label declared twice in one function', () => {
    expect(errs(['A.sm', '!f()\nL:\nL:\n<--'])).toEqual(['label L already exists in function f'])
  })

  it('rejects a local the function does not declare', () => {
    expect(errs(['A.sm', '!f()\n<-@this\n<--'])).toEqual(['f has no local named this'])
  })

  it('rejects an argument and an internal variable sharing a name', () => {
    expect(errs(['A.sm', '!f(x)x\n<--'])).toEqual(['f declares x twice'])
  })

  // A global and a function may share a name; they are written differently
  // where they are used (spec/sm.md section 4).
  it('lets a global and a function share a name', () => {
    expect(errs(['A.sm', '!f()\n<-f\n->f\nf\n<--'])).toEqual([])
  })

  it('lets a label and a variable share a name', () => {
    expect(errs(['A.sm', '!f(x)\nx:\n<-@x\n-->x\n<--'])).toEqual([])
  })

  it('lets two functions use the same label name', () => {
    expect(errs(['A.sm', '!f()\nL:\n-->L\n!g()\nL:\n-->L'])).toEqual([])
  })
})
