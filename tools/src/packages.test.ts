/**
 * M6's acceptance test.
 *
 * For every test in both packages: the `.cmp` is satisfied twice over, once
 * by running the SM source in our emulator and once by running the assembly
 * the reference translator produces in the course's own CPU emulator. That
 * the two agree is the whole premise of the exercise — a student's `.asm` is
 * graded against a file generated from the source.
 *
 * And a translator that is wrong must fail, or the tests grade nothing.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, resolve, type SmFile } from '@sm/core'
import { translate } from '@sm/to-asm'
import { runScript } from '@sm/tst'
import { nodeHost } from './node-host.js'
import { testsIn, type TestCase } from './make-cmp.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..')
const COURSE_TOOLS = '/home/user/tcarreira/nand2tetris/tools'

const haveJava = (() => {
  try {
    execFileSync('java', ['-version'], { stdio: 'ignore' })
    return existsSync(join(COURSE_TOOLS, 'CPUEmulator.sh'))
  } catch {
    return false
  }
})()

const packages = ['projects/07-sm', 'projects/08-sm']

function sources(dir: string): SmFile[] {
  const names = execFileSync('ls', [dir], { encoding: 'utf8' })
    .split('\n')
    .filter((n) => n.endsWith('.sm'))
    .sort()
  const files = names.map((n) => {
    const r = parse(n, readFileSync(join(dir, n), 'utf8'))
    expect(r.diagnostics.map((d) => `${n}:${d.pos.line} ${d.message}`)).toEqual([])
    return r.file
  })
  expect(resolve({ files }).map((d) => d.message)).toEqual([])
  return files
}

/** The bootstrap exists only where there is a Sys.init to call. */
function wantsBootstrap(files: readonly SmFile[]): boolean {
  return files.some((f) => f.functions.some((fn) => fn.decl.name === 'Sys.init'))
}

/** Translate a test into a scratch copy and run its .asm script there. */
function runAsmScript(test: TestCase, mangle?: (asm: string) => string): string {
  const work = mkdtempSync(join(tmpdir(), `sm-${test.name}-`))
  try {
    cpSync(test.dir, work, { recursive: true })
    const files = sources(test.dir)
    let asm = translate(files, { bootstrap: wantsBootstrap(files) })
    if (mangle) asm = mangle(asm)
    writeFileSync(join(work, `${test.name}.asm`), asm)
    execFileSync('sh', [join(COURSE_TOOLS, 'Assembler.sh'), join(work, `${test.name}.asm`)], { stdio: 'pipe' })
    return execFileSync('sh', [join(COURSE_TOOLS, 'CPUEmulator.sh'), join(work, `${test.name}.tst`)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

for (const pkg of packages) {
  describe(pkg, () => {
    const tests = testsIn(join(root, pkg))

    it('has its tests', () => {
      expect(tests.length).toBeGreaterThan(0)
    })

    for (const test of tests) {
      describe(test.name, () => {
        it('ships no .asm — the student writes that', () => {
          expect(existsSync(join(test.dir, `${test.name}.asm`))).toBe(false)
        })

        it('satisfies its .cmp from the SM source', () => {
          const script = join(test.dir, `${test.name}SM.tst`)
          const r = runScript(readFileSync(script, 'utf8'), nodeHost(script))
          expect(r.comparison).toEqual({ ok: true })
        })

        it.skipIf(!haveJava)('satisfies the same .cmp from the assembly', () => {
          expect(runAsmScript(test)).toContain('Comparison ended successfully')
        })
      })
    }
  })
}

describe('a translator that is wrong', () => {
  // If a broken translation still passed, the tests would be grading nothing.
  // The break is plausible rather than catastrophic: reversing the operands
  // of a subtraction is the classic mistake, and it is what the rule about
  // the deeper operand exists to pin down.
  //
  // Note the `g`. Breaking only the *first* `M=M-D` leaves StackTest passing,
  // because the first one in the output belongs to `==`, which computes
  // `!(v | -v)` over the difference and so cannot tell `x-y` from `y-x`. The
  // mistake has to reach `-` and `<` to be visible at all — a reminder that a
  // test suite catches a wrong translation only where the wrongness shows.
  const reverseSubtraction = (asm: string): string => asm.replace(/^M=M-D$/gm, 'M=D-M')

  it.skipIf(!haveJava)('fails StackTest', () => {
    const test = testsIn(join(root, 'projects/07-sm')).find((t) => t.name === 'StackTest')!
    let output = ''
    try {
      output = runAsmScript(test, reverseSubtraction)
    } catch (error) {
      output = error instanceof Error ? error.message : String(error)
    }
    expect(output).toContain('Comparison failure')
  })
})
