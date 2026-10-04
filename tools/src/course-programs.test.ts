/**
 * The course's own Jack programs, compiled by our compiler and run on SM.
 *
 * Three of its project 12 tests come with real compare files, so those are
 * checked against the course's expected output exactly as a student's are,
 * through our own .tst runner. The rest, and the project 11 programs, are
 * observational in the course — the student looks at the screen — so here
 * they are asserted on what the screen and the RAM actually hold.
 *
 * The corpus is the course's material and stays out of the repo, so all of
 * this skips where the course is not installed.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Emulator } from '@sm/emulator'
import { parse, type SmFile } from '@sm/core'
import { compileClass, parseClass } from '@sm/jack'
import { runScript } from '@sm/tst'
import { nodeHost } from './node-host.js'
import { screenLines } from './screen-text.js'

const COURSE = '/home/user/tcarreira/nand2tetris/projects'
const have = existsSync(COURSE)

/** Compile every .jack in a directory. */
function compileDir(dir: string): SmFile[] {
  return readdirSync(dir).filter((f) => f.endsWith('.jack')).sort().map((f) => {
    const source = readFileSync(join(dir, f), 'utf8')
    const { sm, warnings } = compileClass(f, parseClass(f, source))
    expect([f, warnings]).toEqual([f, []])
    const { file, diagnostics } = parse(f.replace(/\.jack$/, '.sm'), sm)
    expect([f, diagnostics]).toEqual([f, []])
    return file
  })
}

function runProgram(dir: string, budget: number): Emulator {
  const emulator = new Emulator()
  emulator.load(compileDir(dir), { library: true })
  for (let i = 0; i < budget && emulator.running; i++) {
    if (emulator.at() === 'Sys.halt') break
    emulator.step()
  }
  return emulator
}

function blackPixels(emulator: Emulator): number {
  let n = 0
  for (const word of emulator.memory.slice(16384, 24576)) {
    let w = word & 0xffff
    while (w !== 0) { n += w & 1; w >>>= 1 }
  }
  return n
}

// The three project 12 tests the course ships a .cmp with. The script is the
// course's, with `vmstep` for `smstep`: an SM step is not a VM step, so the
// count is ours, but everything the script asserts is theirs.
describe.skipIf(!have)('project 12, against the course\'s compare files', () => {
  for (const name of ['ArrayTest', 'MathTest', 'MemoryTest']) {
    it(name, () => {
      const dir = join(COURSE, '12', name)
      const work = mkdtempSync(join(tmpdir(), `sm-${name}-`))
      try {
        for (const f of readdirSync(dir).filter((n) => n.endsWith('.jack'))) {
          const { sm } = compileClass(f, parseClass(f, readFileSync(join(dir, f), 'utf8')))
          writeFileSync(join(work, f.replace(/\.jack$/, '.sm')), sm)
        }
        const script = readFileSync(join(dir, `${name}.tst`), 'utf8')
          .replace(/\r\n/g, '\n')
          .replace(/\bvmstep\b/g, 'smstep')
        writeFileSync(join(work, `${name}.tst`), script)
        writeFileSync(join(work, `${name}.cmp`), readFileSync(join(dir, `${name}.cmp`), 'utf8').replace(/\r\n/g, '\n'))

        const result = runScript(script, nodeHost(join(work, `${name}.tst`)))
        expect(result.comparison).toEqual({ ok: true })
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
    })
  }
})

describe.skipIf(!have)('project 12, the tests with no compare file', () => {
  // The course asks a person to look at the screen for these. Reading the
  // screen back as text asks instead, and the answers are the ones its own
  // reference images show.
  it('OutputTest prints what its reference image shows', () => {
    const emulator = runProgram(join(COURSE, '12', 'OutputTest'), 8_000_000)
    expect(emulator.at()).toBe('Sys.halt')
    expect(screenLines(emulator)).toEqual([
      `A${' '.repeat(62)}B`,
      '0123456789',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz',
      '!#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~"',
      // printInt(-12345), one backspace, printInt(6789).
      '-12346789',
      `C${' '.repeat(62)}D`,
    ])
  })

  it('StringTest prints what its reference image shows', () => {
    const emulator = runProgram(join(COURSE, '12', 'StringTest'), 8_000_000)
    expect(emulator.at()).toBe('Sys.halt')
    expect(screenLines(emulator)).toEqual([
      'new,appendChar: abcde',
      'setInt: 12345',
      'setInt: -32767',
      'length: 5',
      'charAt[2]: 99',
      "setCharAt(2,'-'): ab-de",
      'eraseLastChar: ab-d',
      'intValue: 456',
      'intValue: -32123',
      'backSpace: 129',
      'doubleQuote: 34',
      'newLine: 128',
    ])
  })

  it('ScreenTest finishes and draws', () => {
    const emulator = runProgram(join(COURSE, '12', 'ScreenTest'), 8_000_000)
    expect(emulator.at()).toBe('Sys.halt')
    expect(blackPixels(emulator)).toBeGreaterThan(0)
  })

  // SysTest waits for a key and then calls Sys.wait, so the test plays the
  // keyboard for it: hold a key down, let it go.
  it('SysTest finishes, once a key has been pressed and released', () => {
    const emulator = new Emulator()
    emulator.load(compileDir(join(COURSE, '12', 'SysTest')), { library: true })
    let pressedAt = 0
    for (let i = 0; i < 20_000_000 && emulator.running; i++) {
      if (emulator.at() === 'Sys.halt') break
      // Press once the program is asking, rather than at a step count: how
      // long its opening two lines take to draw is not something to guess.
      if (pressedAt === 0 && emulator.at() === 'Keyboard.keyPressed') {
        emulator.memory.set(24576, 75)
        pressedAt = i
      }
      if (pressedAt > 0 && i === pressedAt + 5000) emulator.memory.set(24576, 0)
      emulator.step()
    }
    expect(emulator.at()).toBe('Sys.halt')
  })
})

describe.skipIf(!have)('project 11', () => {
  // ConvertToBin is the one program in the set defined by RAM alone: it
  // reads RAM[8000] and writes its sixteen bits to RAM[8001..8016].
  it('ConvertToBin converts', () => {
    const emulator = new Emulator()
    emulator.load(compileDir(join(COURSE, '11', 'ConvertToBin')), { library: true })
    emulator.memory.set(8000, 23456)
    for (let i = 0; i < 8_000_000 && emulator.running; i++) {
      if (emulator.at() === 'Sys.halt') break
      emulator.step()
    }
    const bits = [...Array(16).keys()].map((i) => emulator.memory.get(8001 + i))
    expect(bits).toEqual([...Array(16).keys()].map((i) => (23456 >> i) & 1))
  })

  // ComplexArrays prints the expected result beside the actual one and asks
  // a person to compare them. Reading the screen back as text does it
  // instead, and makes the one program in the set that states its own
  // expected answers into a real assertion.
  it('ComplexArrays agrees with itself', () => {
    const emulator = runProgram(join(COURSE, '11', 'ComplexArrays'), 8_000_000)
    expect(emulator.at()).toBe('Sys.halt')
    const lines = screenLines(emulator)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      const m = /expected result: (.*); actual result: (.*)$/.exec(line)
      expect([line, m === null ? null : m[1]]).toEqual([line, m === null ? null : m[2]])
    }
  })

  it('Seven prints 7', () => {
    const emulator = runProgram(join(COURSE, '11', 'Seven'), 2_000_000)
    expect(screenLines(emulator)).toEqual(['7'])
  })

  for (const name of ['Average', 'Square', 'Pong']) {
    // Average reads from the keyboard and the other three are interactive,
    // so what is asserted is that they get going and keep going: compiled,
    // linked, and running their own code without faulting.
    it(`${name} compiles, links and runs`, () => {
      const emulator = new Emulator()
      emulator.load(compileDir(join(COURSE, '11', name)), { library: true })
      const own = new Set(
        readdirSync(join(COURSE, '11', name))
          .filter((f) => f.endsWith('.jack'))
          .map((f) => f.replace(/\.jack$/, '')),
      )
      let reachedOwnCode = false
      for (let i = 0; i < 4_000_000 && emulator.running; i++) {
        if (emulator.at() === 'Sys.halt') break
        if (own.has(emulator.at()?.split('.')[0] ?? '')) reachedOwnCode = true
        emulator.step()
      }
      expect(reachedOwnCode).toBe(true)
      expect(emulator.running).toBe(true)
    })
  }
})
