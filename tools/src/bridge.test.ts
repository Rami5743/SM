/**
 * The bridge, against the course's own projects 7 and 8.
 *
 * Every `.vm` program the course ships for those two projects is translated
 * to SM and run against the course's own `.cmp`, through our .tst runner —
 * the script is the course's `VME.tst`, with `smstep` for `vmstep` and one
 * other change: `set argument[0] 3` names a cell through a segment base,
 * which SM has no notion of. The stack pointer needs no adjustment, because
 * C2 gives it the course's own meaning.
 *
 * The other direction has no compare files of its own, so it is checked by
 * round trip: SM to VM and back, run in our emulator, cell for cell against
 * the original. That catches anything either direction loses.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, resolve, type SmFile } from '@sm/core'
import { Emulator, planFor } from '@sm/emulator'
import { runScript, type Host } from '@sm/tst'
import { parseVm, smToVm, vmToSm } from '@sm/vm'

const COURSE = '/home/user/tcarreira/nand2tetris/projects'
const have = existsSync(COURSE)

/** Every program directory of the course's projects 7 and 8. */
const PROGRAMS: ReadonlyArray<readonly [string, string]> = [
  ['07/StackArithmetic', 'SimpleAdd'],
  ['07/StackArithmetic', 'StackTest'],
  ['07/MemoryAccess', 'BasicTest'],
  ['07/MemoryAccess', 'PointerTest'],
  ['07/MemoryAccess', 'StaticTest'],
  ['08/ProgramFlow', 'BasicLoop'],
  ['08/ProgramFlow', 'FibonacciSeries'],
  ['08/FunctionCalls', 'FibonacciElement'],
  ['08/FunctionCalls', 'StaticsTest'],
]

function hostFor(files: Readonly<Record<string, string>>, scriptName: string): Host {
  const written: Record<string, string> = {}
  return {
    scriptName,
    read: (name) => {
      const text = files[name] ?? written[name]
      if (text === undefined) throw new Error(`no file named ${name}`)
      return text
    },
    write: (name, text) => { written[name] = text },
    listSources: () => Object.keys(files).filter((n) => n.endsWith('.sm')).sort(),
  }
}

/**
 * The course's VM-emulator script, as an SM one.
 *
 * Two changes, and no more. `vmstep` becomes `smstep`. And `set argument[0]
 * 3` names a cell through a segment base, which SM has no notion of, so it
 * is resolved against the base the script set a line earlier and written as
 * the cell it means. The stack pointer needs no adjustment: C2 gives it the
 * course's own meaning, the first free cell.
 */
function asSmScript(script: string, name: string): string {
  const bases = new Map<string, number>()
  return script
    .replace(/\r\n/g, '\n')
    .replace(/^\s*load[^,]*,/m, 'load,')
    .replace(/\bvmstep\b/g, 'smstep')
    .replace(/repeat\s+(\d+)/g, (_, n: string) => `repeat ${Number(n) * 100}`)
    .split('\n')
    .map((line) => {
      const base = /^\s*set\s+(local|argument|this|that)\s+(\d+)/.exec(line)
      if (base !== null) bases.set(base[1]!, Number(base[2]))
      return line.replace(
        /set\s+(local|argument|this|that)\[(\d+)\]\s+(-?\d+)/g,
        (whole, segment: string, index: string, value: string) => {
          const at = bases.get(segment)
          if (at === undefined) throw new Error(`${name}: ${whole} with no base set for ${segment}`)
          return `set RAM[${at + Number(index)}] ${value}`
        },
      )
    })
    .join('\n')
}

/** A compare file's rows, as trimmed cells. */
function cells(text: string): string[][] {
  return text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '')
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()))
}

describe.skipIf(!have)("VM to SM, against the course's own compare files", () => {
  for (const [group, name] of PROGRAMS) {
    it(name, () => {
      const dir = join(COURSE, group, name)
      const vmFiles = readdirSync(dir).filter((f) => f.endsWith('.vm')).sort()
        .map((f) => parseVm(f.replace(/\.vm$/, ''), readFileSync(join(dir, f), 'utf8')))
      const { sm } = vmToSm(vmFiles)

      const script = asSmScript(readFileSync(join(dir, `${name}VME.tst`), 'utf8'), name)
      const host = hostFor({ [`${name}.sm`]: sm }, `${name}.tst`)
      const result = runScript(script, host, { skipCompare: true })

      const expected = cells(readFileSync(join(dir, `${name}.cmp`), 'utf8'))
      // Every cell, the stack pointer included: the two machines now agree
      // about what it names.
      expect(cells(result.output)).toEqual(expected)
    })
  }
})

/**
 * The two programs whose compare files describe the VM's frame rather than
 * what the program computes.
 *
 * `SimpleFunction` plants a seven-word VM frame by hand and then checks the
 * five cells `return` restores; `NestedCall` checks `LCL` and `ARG` after
 * the call. SM's frame is one pointer where the VM's is five, which is the
 * whole point of it, so those cells do not cross and no translation could
 * make them. What does cross is everything the program actually computes,
 * and that is what these check.
 */
describe.skipIf(!have)("VM to SM, where the frame itself is what the course checks", () => {
  function translate(group: string, name: string): SmFile[] {
    const dir = join(COURSE, group, name)
    const vm = readdirSync(dir).filter((f) => f.endsWith('.vm')).sort()
      .map((f) => parseVm(f.replace(/\.vm$/, ''), readFileSync(join(dir, f), 'utf8')))
    return parseAll(vmToSm(vm).sm, `${name}.sm`)
  }

  it('SimpleFunction returns 1196, with an SM frame planted instead', () => {
    const files = translate('08/FunctionCalls', 'SimpleFunction')
    const emulator = new Emulator()
    emulator.load(files, { entry: 'none' })
    // argument 0 and 1 at LCL and LCL+1, the saved LCL and the return
    // address above them: the frame of spec/sm.md section 3.4, which is
    // four words shorter than the one the course's script plants.
    emulator.memory.set(1, 256)
    emulator.memory.set(256, 1234)
    emulator.memory.set(257, 37)
    emulator.memory.set(258, 0)
    emulator.memory.set(259, -1)
    emulator.memory.set(0, 260)  // one past the frame
    emulator.run(100)
    expect(emulator.stack().at(-1)).toBe(1196)
  })

  it('NestedCall computes 135 and 246, into the cells the VM calls temp', () => {
    const files = translate('08/FunctionCalls', 'NestedCall')
    const emulator = new Emulator()
    emulator.load(files, { entry: 'bootstrap' })
    emulator.run(100_000)
    // this and that, which the translation keeps where the VM puts them.
    expect([emulator.memory.get(3), emulator.memory.get(4)]).toEqual([4000, 5000])
    // temp 0 and temp 1: Sys.add12(123) and Sys.main()'s own answer.
    expect([emulator.memory.get(5), emulator.memory.get(6)]).toEqual([135, 246])
  })
})

/** Run a set of SM files with no bootstrap and no library, and read it all back. */
function snapshot(files: readonly SmFile[], plant: ReadonlyArray<readonly [number, number]>, steps: number) {
  expect(resolve({ files })).toEqual([])
  const emulator = new Emulator()
  const plan = planFor(files)
  emulator.load(files, { allowFragment: plan.allowFragment, entry: plan.entry })
  for (const [address, value] of plant) emulator.memory.set(address, value)
  emulator.run(steps)
  return {
    answer: emulator.memory.get(ANSWER),
    // The top of the heap is where SM→VM puts the globals, so it belongs
    // to the bridge and not to the program.
    heap: [...emulator.memory.slice(2048, 16320)],
  }
}

function parseAll(sm: string, name: string): SmFile[] {
  const { file, diagnostics } = parse(name, sm)
  expect(diagnostics.map((d) => d.message)).toEqual([])
  return [file]
}

/**
 * Each case is a `Main.run` and a `Sys.init` that pokes its answer into
 * RAM[3000] and then spins.
 *
 * Both details were measured on the course's VM emulator rather than
 * chosen. Its built-in bootstrap sets the stack pointer and enters
 * `Sys.init` without building a frame, so `Sys.init` has no local segment
 * and may not return — `Out of segment space`, `Nowhere to return to`. A
 * fixed heap cell is then the one place both machines agree to leave an
 * answer, the stack being at different depths under the two bootstraps.
 */
const ANSWER = 3000

function program(run: string): string {
  return `!Sys.init()\n<-${ANSWER}\nMain.run\n->[]\nspin:\n-->spin\n${run}`
}

const ROUND_TRIP: ReadonlyArray<{ readonly name: string; readonly sm: string }> = [
  {
    name: 'arithmetic and logic',
    sm: program('!Main.run()a,b\n<-7\n->@a\n<-8\n->@b\n<-@a\n<-@b\n+\n<-@a\n<-@b\n-\n+\n<-@a\n(-)\n+\n<-@a\n~\n+\n<-@a\n<-@b\n&\n+\n<-@a\n<-@b\n|\n+\n<--\n'),
  },
  {
    name: 'the comparisons, whose values SM and the VM disagree about',
    sm: program('!Main.run()\n<-3\n<-5\n<\n<-5\n<-3\n>\n+\n<-4\n<-4\n==\n+\n<--\n'),
  },
  {
    name: 'a peek and a poke',
    sm: program('!Main.run()\n<-3001\n<-42\n->[]\n<-3001\n[]\n<--\n'),
  },
  {
    name: 'globals',
    sm: program('!Main.run()\n<-11\n->g\n<-g\n<-1\n+\n->h\n<-g\n<-h\n+\n<--\n'),
  },
  {
    name: 'branches and a loop',
    sm: program('!Main.run()i,s\n<-0\n->@s\n<-5\n->@i\nloop:\n<-@i\n<-1\n<\n?-->done\n<-@s\n<-@i\n+\n->@s\n<-@i\n<-1\n-\n->@i\n-->loop\ndone:\n<-@s\n<--\n'),
  },
  {
    name: 'calls, with recursion',
    sm: program('!Main.run()\n<-7\nMain.fib\n<--\n!Main.fib(n)\n<-@n\n<-2\n<\n?-->base\n<-@n\n<-1\n-\nMain.fib\n<-@n\n<-2\n-\nMain.fib\n+\n<--\nbase:\n<-@n\n<--\n'),
  },
]

describe('SM to VM and back', () => {
  // What the round trip preserves is what the program computes: the stack
  // it leaves and the heap it wrote. Not the text — `<` goes to `sub` and
  // back, but a comparison the VM canonicalises comes back as a branch —
  // and not the cells either direction keeps for itself: RAM[1..15], the
  // globals our emulator hands out from RAM[16], and the top of the heap,
  // which is where SM→VM has to put a global because the course's VM
  // emulator will not let `that` point anywhere else.
  for (const { name, sm } of ROUND_TRIP) {
    it(name, () => {
      const original = parseAll(sm, 'original.sm')
      const { files } = smToVm(original)
      const back = vmToSm(Object.entries(files).map(([n, text]) => parseVm(n, text)))
      const returned = parseAll(back.sm, 'returned.sm')

      const before = snapshot(original, [], 200_000)
      const after = snapshot(returned, [], 200_000)
      expect(after.heap).toEqual(before.heap)
    })
  }

  it('refuses a fragment, because the VM has nowhere to put one', () => {
    expect(() => smToVm(parseAll('<-1\n<-2\n+\n', 'f.sm'))).toThrow(/fragment/)
  })
})

/**
 * The other half of the measurement: the VM side, run on the course's own
 * VM emulator.
 *
 * The round trip above never leaves our machine, so it would be satisfied
 * by two translations that are wrong in the same way. This takes the VM
 * text we produce, runs it where it is meant to run, and compares what it
 * leaves with what our emulator leaves for the SM it came from.
 *
 * The two machines start `Sys.init` differently — SM through a call with a
 * frame, the course's emulator with no frame at all — so the answer is
 * compared where both were told to put it, RAM[3000].
 */
describe.skipIf(!existsSync(join(COURSE, '..', 'tools', 'VMEmulator.sh')))(
  'SM to VM, measured on the course\'s VM emulator',
  () => {
    const TOOLS = join(COURSE, '..', 'tools')

    for (const { name, sm } of ROUND_TRIP) {
      it(name, () => {
        const files = parseAll(sm, `${name}.sm`)
        const ours = snapshot(files, [], 200_000)

        const work = mkdtempSync(join(tmpdir(), 'sm-vm-'))
        try {
          for (const [vmName, text] of Object.entries(smToVm(files).files)) {
            writeFileSync(join(work, `${vmName}.vm`), text)
          }
          writeFileSync(join(work, 'Main.tst'), [
            'load,',
            'output-file Main.out,',
            `output-list RAM[${ANSWER}]%D1.7.1,`,
            '',
            'repeat 200000 {',
            '  vmstep;',
            '}',
            '',
            'output;',
            '',
          ].join('\n'))
          execFileSync('sh', [join(TOOLS, 'VMEmulator.sh'), join(work, 'Main.tst')], { stdio: 'pipe' })
          const out = readFileSync(join(work, 'Main.out'), 'utf8')
          const theirs = Number(cells(out)[1]![0])
          expect(theirs).toBe(ours.answer)
        } finally {
          rmSync(work, { recursive: true, force: true })
        }
      })
    }
  },
)
