/**
 * M1's acceptance test: every sample in reference/ parses, and printing a
 * parsed file and parsing it again gives the same tree.
 *
 * The round trip is on the tree, not the text: printing drops comments and
 * indentation, which is right. What must survive is every command, in order,
 * with its operands.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parse } from './parse.js'
import { printFile } from './print.js'
import type { Command, SmFile } from './ast.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../..')

/** Every .sm file under reference/, found rather than listed. */
const samples = execFileSync('find', [join(root, 'reference'), '-name', '*.sm'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((p) => p.length > 0)
  .sort()

/** The tree without positions: what a round trip must preserve. */
function shape(file: SmFile): unknown {
  const strip = (c: Command): unknown => {
    const { pos: _pos, ...rest } = c
    return rest
  }
  return {
    fragment: file.fragment.map(strip),
    functions: file.functions.map((fn) => ({
      name: fn.decl.name,
      args: fn.decl.args,
      locals: fn.decl.locals,
      body: fn.body.map(strip),
    })),
  }
}

describe('every sample in reference/', () => {
  it('finds some', () => {
    expect(samples.length).toBeGreaterThanOrEqual(6)
  })

  for (const path of samples) {
    const name = relative(root, path)

    it(`${name} parses without complaint`, () => {
      const r = parse(name, readFileSync(path, 'utf8'))
      expect(r.diagnostics.map((d) => `line ${d.pos.line}: ${d.message}`)).toEqual([])
    })

    it(`${name} round-trips`, () => {
      const first = parse(name, readFileSync(path, 'utf8')).file
      const again = parse(name, printFile(first)).file
      expect(shape(again)).toEqual(shape(first))
    })
  }
})

describe('the word rendering', () => {
  const src = '!f(a)t\n<-7\n<-@a\n+\n->@t\n<-x\n->x\nL:\n?-->L\n-->L\ng\n[]\n->[]\n<--\n!g()\n<-0\n<--'

  it('spells the structural commands out', () => {
    const file = parse('T.sm', src).file
    const words = printFile(file, 'words')
    for (const w of ['push ', 'pop ', 'label L', 'if-goto L', 'goto L', 'call g', 'return', 'function f(a) locals t']) {
      expect(words).toContain(w)
    }
  })

  // CORRECTIONS C4: the arithmetic and logical operators stay symbolic in
  // every view. Only the structural commands have a word form.
  it('leaves the operators symbolic', () => {
    const words = printFile(parse('T.sm', src).file, 'words')
    expect(words).toMatch(/^\+$/m)
    expect(words).toMatch(/^\[\]$/m)
    expect(words).toMatch(/^->\[\]$/m)
    for (const forbidden of ['add', 'sub', 'neg', 'and', 'or', 'not', 'eq', 'gt', 'lt', 'peek', 'poke']) {
      expect(words).not.toMatch(new RegExp(`^${forbidden}$`, 'm'))
    }
  })
})
