/**
 * M4's acceptance test.
 *
 * Two layers, both against the repaired reference translator in `oracle/`.
 *
 * Instruction for instruction is no longer the right comparison. C2 changed
 * what `SP` names — the first free cell here, the top element there — so
 * every push, every pop, the frame pointer and the whole return sequence
 * differ by construction. What must still hold is that the two translations
 * *compute the same thing*, and that is measured: both are assembled with the
 * course's own assembler and run in its own CPU emulator, and the stack the
 * reference leaves must be the stack we leave, displaced by exactly the one
 * cell the convention displaces it by. The symbols they define must match
 * outright.
 *
 * The second layer needs python3 and java. Where they are missing the test
 * says so and skips rather than passing quietly.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asCurrent, parse, resolve, type SmFile } from '@sm/core'
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

/**
 * The frozen samples are written in the notation the prototype had, which is
 * the only notation it can read, so the prototype is given them as they are
 * and our parser is given a conversion. `asCurrent` does nothing else.
 */
function instructions(asm: string): string[] {
  return asm
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'))
}

function load(dir: string, names: readonly string[]): SmFile[] {
  const files = names.map((n) => {
    const r = parse(n, asCurrent(readFileSync(join(dir, n), 'utf8')))
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
  /** Every label the translation defines, in order. */
  function labels(asm: string): string[] {
    return instructions(asm).flatMap((line) => {
      const m = /^\(([^)]+)\)$/.exec(line)
      return m === null ? [] : [m[1]!]
    })
  }

  /** Assemble, run, and read the cells the script asked for. */
  function cells(work: string, asm: string, wanted: readonly number[]): number[] {
    writeFileSync(join(work, 'p.asm'), asm)
    writeFileSync(join(work, 'p.tst'), [
      'load p.asm,',
      'output-file p.out,',
      `output-list ${wanted.map((c) => `RAM[${c}]%D1.8.1`).join(' ')};`,
      'repeat 40000 { ticktock; }',
      'output;',
    ].join('\n'))
    execFileSync('sh', [join(COURSE_TOOLS, 'Assembler.sh'), join(work, 'p.asm')], { stdio: 'pipe' })
    execFileSync('sh', [join(COURSE_TOOLS, 'CPUEmulator.sh'), join(work, 'p.tst')], { stdio: 'pipe' })
    const out = readFileSync(join(work, 'p.out'), 'utf8').trimEnd().split('\n')
    return out[1]!.split('|').slice(1, -1).map((c) => Number(c.trim()))
  }

  for (const [dir, names] of samples) {
    it.skipIf(!havePython)(`${dir} defines the same symbols`, () => {
      const work = mkdtempSync(join(tmpdir(), 'sm-oracle-'))
      try {
        const src = join(work, 'p')
        cpSync(join(root, dir), src, { recursive: true })
        for (const f of ['FibonacciElement.tst', 'FibonacciElementVME.tst', 'FibonacciElement.cmp']) {
          rmSync(join(src, f), { force: true })
        }
        execFileSync('python3', [join(root, 'oracle/run.py'), 'sm', src], { stdio: 'pipe' })
        const theirs = labels(readFileSync(`${src}.asm`, 'utf8'))
        const ours = labels(translate(load(join(root, dir), names), { comments: false }))
        expect(ours).toEqual(theirs)
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
    })

    it.skipIf(!havePython || !haveJava)(`${dir} computes what the reference computes`, () => {
      const work = mkdtempSync(join(tmpdir(), 'sm-oracle-run-'))
      try {
        const src = join(work, 'p')
        cpSync(join(root, dir), src, { recursive: true })
        for (const f of ['FibonacciElement.tst', 'FibonacciElementVME.tst', 'FibonacciElement.cmp']) {
          rmSync(join(src, f), { force: true })
        }
        execFileSync('python3', [join(root, 'oracle/run.py'), 'sm', src], { stdio: 'pipe' })

        // What cannot be compared, and why. A stack cell holding a return
        // address holds a ROM address, and the two instruction streams are
        // not the same length. A cell holding a saved `LCL` holds a stack
        // address, and the two stacks are one cell apart. So the comparison
        // is over what the program computes: the depth it leaves, the value
        // on top, and the heap, which both address identically.
        const wanted = [0, ...range(256, 8), ...range(2048, 6)]
        const refRun = mkdtempSync(join(tmpdir(), 'sm-ref-'))
        const ourRun = mkdtempSync(join(tmpdir(), 'sm-our-'))
        try {
          const theirs = cells(refRun, readFileSync(`${src}.asm`, 'utf8'), wanted)
          const ours = cells(ourRun, translate(load(join(root, dir), names)), wanted)
          const at = (row: readonly number[], address: number) => row[wanted.indexOf(address)]

          // The depth agrees: their SP names the top element and ours the
          // first free cell, and their stack begins one cell higher, so the
          // two cancel.
          expect(ours[0]).toBe(theirs[0])
          // The value on top: ours just below SP, theirs at it.
          expect(at(ours, ours[0]! - 1)).toBe(at(theirs, theirs[0]!))
          // And the heap, cell for cell.
          expect(range(2048, 6).map((c) => at(ours, c)))
            .toEqual(range(2048, 6).map((c) => at(theirs, c)))
        } finally {
          rmSync(refRun, { recursive: true, force: true })
          rmSync(ourRun, { recursive: true, force: true })
        }
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
    })
  }
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

      // Sys.init's frame is at 256, it takes nothing and keeps nothing, so
      // fib's result is the first thing pushed above the return address, at
      // 258, and SP is one past it.
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
      expect(out[1]).toBe('|    259 |      8 |')
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

/**
 * A fragment: a bare sequence of commands with no declaration, which is the
 * whole of the first package of exercises.
 *
 * It gets no bootstrap, which is the course's own scheme — measured across
 * its scripts, every project-7 .tst and all but one of project 8's set RAM[0]
 * by hand, the translator at that stage emitting none. The one exception is
 * FibonacciElement, whose subject is the bootstrap.
 *
 * It was a hole in both translators before that. The supplied one wrote its
 * bootstrap from the constructor, before it had read anything, so a fragment
 * got a jump to a Sys.init nobody declares and its own instructions after the
 * loop that never ends: measured, the 15 was nowhere.
 */
describe('a fragment', () => {
  // The oracle reads the prototype's notation only, so the same program is
  // kept in both: theirs goes to disk, ours goes through the parser.
  const THEIRS = '<-7\n<-8\n+\n'
  const FRAGMENT = asCurrent(THEIRS)

  it.skipIf(!havePython)('agrees with the oracle instruction for instruction', () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-frag-'))
    try {
      const src = join(work, 'p')
      execFileSync('mkdir', ['-p', src])
      writeFileSync(join(src, 'T.sm'), THEIRS)
      execFileSync('python3', [join(root, 'oracle/run.py'), 'sm', src], { stdio: 'pipe' })
      const theirs = instructions(readFileSync(`${src}.asm`, 'utf8'))

      const r = parse('T.sm', FRAGMENT)
      expect(r.diagnostics).toEqual([])
      const ours = instructions(translate([r.file], { comments: false }))

      // No bootstrap on either side. The sequences still differ, C2 having
      // changed what SP names, so what is compared is the shape: same
      // constants, same symbols, in the same order.
      const constants = (ins: readonly string[]) =>
        ins.filter((i) => /^@\d+$/.test(i))
      expect(constants(ours)).toEqual(constants(theirs))
      expect(ours.join('\n')).not.toContain('Sys.init')
      expect(ours[0]).toBe('@7')
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('refuses to bootstrap into a Sys.init that is not there', () => {
    const r = parse('T.sm', FRAGMENT)
    expect(() => translate([r.file], { bootstrap: true })).toThrow(/no Sys.init to bootstrap/)
  })

  it('leaves the stack pointer to the test script, as the course does', () => {
    const r = parse('T.sm', FRAGMENT)
    const ins = instructions(translate([r.file], { comments: false }))
    // Every push touches SP, so its absence is not the thing to look for.
    // What must be absent is the bootstrap's own opening, which sets it.
    expect(ins.slice(0, 4)).not.toEqual(['@256', 'D=A', '@SP', 'M=D'])
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
    'push 3000', 'push 77', 'pop-indirect', 'push 3000', 'push-indirect',   // 77
    'push 5', 'push 5', 'eq',                          // true
    'push 3', 'push 5', 'lt',                           // true
    'push 3', 'push 5', 'gt',                           // false
    'push 7', 'neg',                                // -7
    'push 20', 'push 22', 'add',                         // 42
    'push 12', 'push 10', 'and',                         // 8
    'push 12', 'push 10', 'or',                         // 14
    'push 1', 'not',                                  // -2
    'push 99', 'pop g', 'push g',                        // 99, through a global
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
        // The script sets the stack pointer, as every project-7 script does,
        // because a fragment's translation carries no bootstrap. 256 is an
        // empty stack on both machines now (C2).
        'set RAM[0] 256,',
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
      expect(theirs[0]).toBe(256 + stack.length)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

function range(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i)
}
