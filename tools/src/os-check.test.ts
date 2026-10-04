import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse, resolve } from '@sm/core'
import { lintDepth } from './depth-lint.js'

const DIR = join(import.meta.dirname, '..', '..', 'os', 'sm')
const files = readdirSync(DIR).filter((f) => f.endsWith('.sm')).sort()

describe('the compiled library', () => {
  const parsed = files.map((f) => {
    const r = parse(f, readFileSync(join(DIR, f), 'utf8'))
    return { f, r }
  })

  it('parses with no diagnostics', () => {
    for (const { f, r } of parsed) expect([f, r.diagnostics]).toEqual([f, []])
  })

  it('is balanced on the stack', () => {
    expect(lintDepth(parsed.map((p) => p.r.file))).toEqual([])
  })

  it('resolves, apart from the program it is linked with', () => {
    const d = resolve({ files: parsed.map((p) => p.r.file) }).map((x) => x.message)
    expect(d).toEqual(['function Main.main not found'])
  })
})
