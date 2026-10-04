/**
 * M4's acceptance test.
 *
 * Two layers. The first compares our instruction stream with the one the
 * repaired reference translator in `oracle/` emits, for every sample — the
 * only permitted difference being C2, the bootstrap's constant. The second
 * assembles our output with the course's own assembler and runs it in the
 * course's own CPU emulator, which is the check that nothing subtle is wrong.
 *
 * The second layer needs python3 and java. Where they are missing the test
 * says so and skips rather than passing quietly.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, resolve, type SmFile } from '@sm/core'
import { Emulator } from '@sm/emulator'
import { translate } from './translate.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../..')
const COURSE_TOOLS = '/home/user/tcarreira/nand2tetris/tools'

function have(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const havePython = have('python3', ['--version'])
const haveJava = have('java', ['-version']) && existsSync(join(COURSE_TOOLS, 'Assembler.sh'))

/** Instructions only: no comments, no blank lines. */
function instructions(asm: string): string[] {
  return asm
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'))
}

function load(dir: string, names: readonly string[]): SmFile[] {
  const files = names.map((n) => {
    const r = parse(n, readFileSync(join(dir, n), 'utf8'))
    expect(r.diagnostics.map((d) => d.message)).toEqual([])
    return r.file
  })
  expect(resolve({ files }).map((d) => d.message)).toEqual([])
  return files
}

const samples: Array<[string, string[]]> = [
  ['reference/samples/FibonacciElement_sm', ['Main.sm', 'Sys.sm']],
  ['reference/samples/FibonacciSeries_sm', ['fib.sm', 'sys.sm']],
]

describe('against the oracle', () => {
  for (const [dir, names] of samples) {
    it.skipIf(!havePython)(`${dir} agrees instruction for instruction`, () => {
      const work = mkdtempSync(join(tmpdir(), 'sm-oracle-'))
      try {
        const src = join(work, 'p')
        cpSync(join(root, dir), src, { recursive: true })
        // Only the .sm files; the directory also holds .tst and .cmp.
        for (const f of ['FibonacciElement.tst', 'FibonacciElementVME.tst', 'FibonacciElement.cmp']) {
          rmSync(join(src, f), { force: true })
        }
        execFileSync('python3', [join(root, 'oracle/run.py'), 'sm', src], { stdio: 'pipe' })
        const theirs = instructions(readFileSync(`${src}.asm`, 'utf8'))
        const ours = instructions(translate(load(join(root, dir), names), { comments: false }))

        // The one permitted difference: C2 puts 255 where the reference put
        // 256, so that the first value pushed lands at 256.
        expect(theirs[0]).toBe('@256')
        expect(ours[0]).toBe('@255')
        expect(ours.slice(1)).toEqual(theirs.slice(1))
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
    })
  }
})

/**
 * The fragment path, which the comparison above does not reach because both
 * samples are whole programs. It was a hole in both translators: the supplied
 * one wrote its bootstrap from the constructor, before it had read anything,
 * so a fragment got a jump to a Sys.init nobody declares and its own
 * instructions after the loop that never ends. Measured, the 15 was nowhere.
 * Repaired in oracle/, and compared here.
 */
describe('a fragment', () => {
  const FRAGMENT = '<-7\n<-8\n+\n'

  it.skipIf(!havePython)('agrees with the oracle instruction for instruction', () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-frag-'))
    try {
      const src = join(work, 'p')
      execFileSync('mkdir', ['-p', src])
      writeFileSync(join(src, 'T.sm'), FRAGMENT)
      execFileSync('python3', [join(root, 'oracle/run.py'), 'sm', src], { stdio: 'pipe' })
      const theirs = instructions(readFileSync(`${src}.asm`, 'utf8'))

      const r = parse('T.sm', FRAGMENT)
      expect(r.diagnostics).toEqual([])
      const ours = instructions(translate([r.file], { comments: false }))

      expect(theirs[0]).toBe('@256')
      expect(ours[0]).toBe('@255')
      expect(ours.slice(1)).toEqual(theirs.slice(1))
      // And nothing calls a Sys.init that is not there.
      expect(ours.join('\n')).not.toContain('Sys.init')
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('through the course\'s own tools', () => {
  it.skipIf(!haveJava)('assembles and runs FibonacciElement to 8', () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-hack-'))
    try {
      const dir = join(root, 'reference/samples/FibonacciElement_sm')
      // The supplied Sys.sm loops for ever, which suits a .tst that counts
      // ticks: the answer is left on the stack and stays there.
      const asm = translate(load(dir, ['Main.sm', 'Sys.sm']))
      writeFileSync(join(work, 'p.asm'), asm)

      // With SP starting at 255, Sys.init's frame is one lower than the
      // reference's, so fib's result lands at 258 rather than 259.
      writeFileSync(join(work, 'p.tst'), [
        'load p.asm,',
        'output-file p.out,',
        'output-list RAM[0]%D1.6.1 RAM[258]%D1.6.1;',
        'repeat 20000 { ticktock; }',
        'output;',
      ].join('\n'))

      execFileSync('sh', [join(COURSE_TOOLS, 'Assembler.sh'), join(work, 'p.asm')], { stdio: 'pipe' })
      execFileSync('sh', [join(COURSE_TOOLS, 'CPUEmulator.sh'), join(work, 'p.tst')], { stdio: 'pipe' })

      const out = readFileSync(join(work, 'p.out'), 'utf8').trimEnd().split('\n')
      expect(out[1]).toBe('|    258 |      8 |')
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

/**
 * The equivalence the student packages rest on, and the half of M2's
 * acceptance that could not be checked until this translator existed: the
 * same program, run in our emulator and in the course's CPU emulator on our
 * assembled output, must reach the same cells.
 *
 * *Which* cells is the thing this test pinned down, and the answer is the
 * course's: **the stack, and nothing else.**
 *
 * Two kinds of cell cannot agree and must never appear in a .cmp.
 *
 * A frame's return-address cell holds a ROM address in the assembly, which
 * only the assembler knows, and an index into the emulator's own steps here.
 *
 * A global's cell is wherever the assembler happened to put its symbol, which
 * depends on the order the symbols are met and on what scratch cells the
 * translator uses — so it depends on the *student's* translator, and a .cmp
 * naming it would be grading a free choice. Measured: our globals begin at 16
 * where the reference's begin at 17, because its return sequence names its
 * scratch cell first.
 *
 * The course keeps exactly this rule. Its own StaticTest writes three statics,
 * reads them back and leaves the answer on the stack, and its .cmp names
 * RAM[256] alone.
 */
describe('our emulator and theirs agree', () => {
  // The course's shape: do the work, leave the results on the stack. Every
  // kind of arithmetic, a peek and a poke, and a global written and read
  // back — so that globals are exercised without any cell of theirs being
  // named.
  const FRAGMENT = [
    '<-3000', '<-77', '->[]', '<-3000', '[]',   // 77
    '<-5', '<-5', '==',                          // true
    '<-3', '<-5', '<',                           // true
    '<-3', '<-5', '>',                           // false
    '<-7', '(-)',                                // -7
    '<-20', '<-22', '+',                         // 42
    '<-12', '<-10', '&',                         // 8
    '<-12', '<-10', '|',                         // 14
    '<-1', '~',                                  // -2
    '<-99', '->g', '<-g',                        // 99, through a global
  ].join('\n')

  it.skipIf(!haveJava)('on the stack, after arithmetic of every kind', () => {
    const r = parse('T.sm', FRAGMENT)
    expect(r.diagnostics.map((d) => d.message)).toEqual([])
    const files = [r.file]

    const ours = new Emulator()
    ours.load(files, { allowFragment: true })
    ours.run(10000)
    const stack = ours.stack()
    expect(stack).toEqual([77, -1, -2, 2, -7, 42, 8, 14, -2, 99])

    const work = mkdtempSync(join(tmpdir(), 'sm-agree-'))
    try {
      writeFileSync(join(work, 'p.asm'), translate(files))
      const cells = [0, ...range(256, stack.length + 2)]
      writeFileSync(join(work, 'p.tst'), [
        'load p.asm,',
        'output-file p.out,',
        `output-list ${cells.map((c) => `RAM[${c}]%D1.8.1`).join(' ')};`,
        'repeat 4000 { ticktock; }',
        'output;',
      ].join('\n'))
      execFileSync('sh', [join(COURSE_TOOLS, 'Assembler.sh'), join(work, 'p.asm')], { stdio: 'pipe' })
      execFileSync('sh', [join(COURSE_TOOLS, 'CPUEmulator.sh'), join(work, 'p.tst')], { stdio: 'pipe' })

      const theirs = readFileSync(join(work, 'p.out'), 'utf8')
        .trimEnd().split('\n')[1]!
        .split('|').slice(1, -1).map((c) => Number(c.trim()))

      expect(theirs).toEqual(cells.map((c) => ours.memory.get(c)))
      // The stack pointer too, so the agreement is on the shape and not only
      // on the contents.
      expect(theirs[0]).toBe(255 + stack.length)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

function range(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i)
}
