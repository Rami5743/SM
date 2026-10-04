/**
 * The standard library, run.
 *
 * Each case is a Jack `Main` compiled by our compiler, linked against the
 * library the emulator carries, and run from the bootstrap exactly as a
 * student's program is. What it checks is the value the program leaves in a
 * static, read back by name.
 */
import { Emulator } from '@sm/emulator'
import { parse, type SmFile } from '@sm/core'
import { compileClass, parseClass } from '@sm/jack'

export function compile(sources: Readonly<Record<string, string>>): SmFile[] {
  return Object.entries(sources).map(([name, jack]) => {
    const { sm, warnings } = compileClass(`${name}.jack`, parseClass(`${name}.jack`, jack))
    expect([name, warnings]).toEqual([name, []])
    const { file, diagnostics } = parse(`${name}.sm`, sm)
    expect([name, diagnostics]).toEqual([name, []])
    return file
  })
}

export interface RunResult {
  readonly emulator: Emulator
  readonly value: (global: string) => number
}

/**
 * Run from the bootstrap and stop where `Sys.halt` spins, which is where a
 * finished Jack program ends up. The budget is the escape hatch: a program
 * that never gets there fails on the assertion that follows.
 */
export function run(sources: Readonly<Record<string, string>>, budget = 2_000_000): RunResult {
  const emulator = new Emulator()
  emulator.load(compile(sources), { library: true })
  for (let i = 0; i < budget && emulator.running; i++) {
    if (emulator.at() === 'Sys.halt') break
    emulator.step()
  }
  const value = (global: string) => {
    const address = emulator.globals().get(global)
    if (address === undefined) throw new Error(`no global named ${global}`)
    return emulator.memory.get(address)
  }
  return { emulator, value }
}

/** A Main whose main() leaves answers in statics. */
function main(statics: string, body: string): Record<string, string> {
  return { Main: `class Main { ${statics} function void main() { ${body} return; } }` }
}

describe('Math', () => {
  it('multiplies, including across the sign', () => {
    const { value } = run(main('static int a, b, c, d;', `
      let a = 6 * 7;
      let b = (-6) * 7;
      let c = 123 * 0;
      let d = (-11) * (-11);
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c'), value('Main.d')])
      .toEqual([42, -42, 0, 121])
  })

  it('divides, truncating toward zero', () => {
    const { value } = run(main('static int a, b, c, d;', `
      let a = 100 / 7;
      let b = (-100) / 7;
      let c = 32767 / 1;
      let d = 7 / 100;
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c'), value('Main.d')])
      .toEqual([14, -14, 32767, 0])
  })

  it('takes square roots', () => {
    const { value } = run(main('static int a, b, c, d;', `
      let a = Math.sqrt(0);
      let b = Math.sqrt(1);
      let c = Math.sqrt(144);
      let d = Math.sqrt(32767);
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c'), value('Main.d')])
      .toEqual([0, 1, 12, 181])
  })

  it('has abs, min and max', () => {
    const { value } = run(main('static int a, b, c;', `
      let a = Math.abs(-5);
      let b = Math.min(3, -3);
      let c = Math.max(3, -3);
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c')]).toEqual([5, -3, 3])
  })
})

describe('Memory', () => {
  // peek and poke are the point of the design: in SM they are `[]` and
  // `->[]` over an address on the stack, with no segment to re-point.
  it('peeks and pokes', () => {
    const { value } = run(main('static int a, b;', `
      do Memory.poke(5000, 1234);
      let a = Memory.peek(5000);
      do Memory.poke(5001, -1);
      let b = Memory.peek(5001);
    `))
    expect([value('Main.a'), value('Main.b')]).toEqual([1234, -1])
  })

  it('hands out blocks that do not overlap, and reuses what is freed', () => {
    const { value } = run(main('static int a, b, c, first;', `
      var Array x, y;
      let x = Array.new(10);
      let y = Array.new(10);
      let first = x;
      let x[0] = 11;
      let y[0] = 22;
      let a = x[0];
      let b = y[0];
      let c = 0;
      if (x = y) { let c = 1; }
      do x.dispose();
      do y.dispose();
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c')]).toEqual([11, 22, 0])
    expect(value('Main.first')).toBeGreaterThan(2047)
    expect(value('Main.first')).toBeLessThan(16384)
  })

  it('survives many rounds of allocation and release', () => {
    const { value } = run(main('static int ok;', `
      var int i;
      var Array a;
      let ok = 1;
      let i = 0;
      while (i < 200) {
        let a = Array.new(20);
        let a[19] = i;
        if (~(a[19] = i)) { let ok = 0; }
        do a.dispose();
        let i = i + 1;
      }
    `))
    expect(value('Main.ok')).toBe(1)
  })
})

describe('String', () => {
  it('builds, reads and erases', () => {
    const { value } = run(main('static int a, b, c;', `
      var String s;
      let s = String.new(8);
      let s = s.appendChar(72);
      let s = s.appendChar(105);
      let a = s.length();
      let b = s.charAt(1);
      do s.eraseLastChar();
      let c = s.length();
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c')]).toEqual([2, 105, 1])
  })

  it('reads integers out of text and writes them back', () => {
    const { value } = run(main('static int a, b, c, d;', `
      var String s, t;
      let s = "1234";
      let a = s.intValue();
      let t = "-57";
      let b = t.intValue();
      let s = String.new(8);
      do s.setInt(-908);
      let c = s.length();
      let d = s.charAt(0);
    `))
    expect([value('Main.a'), value('Main.b')]).toEqual([1234, -57])
    expect([value('Main.c'), value('Main.d')]).toEqual([4, 45])
  })

  it('has the three named characters', () => {
    const { value } = run(main('static int a, b, c;', `
      let a = String.newLine();
      let b = String.backSpace();
      let c = String.doubleQuote();
    `))
    expect([value('Main.a'), value('Main.b'), value('Main.c')]).toEqual([128, 129, 34])
  })
})

describe('what the library links', () => {
  const classesOf = (emulator: Emulator) =>
    new Set([...emulator.linked.byName.keys()].map((n) => n.split('.')[0]))

  it('nothing at all, unless asked', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = 1 + 1;')), { entry: 'none' })
    expect(classesOf(emulator)).toEqual(new Set(['Main']))
  })

  it('all eight from the bootstrap, because Sys.init starts them', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = 1 + 1;')), { library: true })
    expect(classesOf(emulator)).toEqual(new Set([
      'Main', 'Sys', 'Memory', 'Math', 'Screen', 'Output', 'Keyboard', 'Array', 'String',
    ]))
  })

  it('nothing, when the program calls none of it and no bootstrap does', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = 1 + 1;')), {
      entry: 'none', library: true,
    })
    expect(classesOf(emulator)).toEqual(new Set(['Main']))
  })

  // Substitution is by whole class, as the course's is, and reachability is
  // by whole class too. In practice that means all of it or none: every
  // class can fail, every failure is `Sys.error`, and `Sys.init` starts all
  // eight. The granularity is worth keeping anyway, because it is what lets
  // a program that touches no library at all carry none of it.
  it('all of it, from any one call, because the error path runs through Sys', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = Math.abs(-1);')), {
      entry: 'none', library: true,
    })
    expect(classesOf(emulator).size).toBe(9)
  })

  it('prefers the program\'s own class over the library\'s', () => {
    // Project 12 is exactly this: replace one class and keep the rest.
    const sources = {
      Main: 'class Main { static int a; function void main() { let a = Math.abs(-5); return; } }',
      Math: 'class Math { function void init() { return; } function int abs(int x) { return 999; } }',
    }
    const emulator = new Emulator()
    emulator.load(compile(sources), { library: true })
    for (let i = 0; i < 2_000_000 && emulator.running; i++) {
      if (emulator.at() === 'Sys.halt') break
      emulator.step()
    }
    const address = emulator.globals().get('Main.a')!
    expect(emulator.memory.get(address)).toBe(999)
  })
})

/** Whether the pixel at (x, y) is black, read straight out of the screen. */
function pixel(result: RunResult, x: number, y: number): boolean {
  const word = result.emulator.memory.get(16384 + (y * 32) + Math.floor(x / 16))
  return ((word >> (x % 16)) & 1) === 1
}

/** How many of the screen's 131072 pixels are black. */
function blackPixels(result: RunResult): number {
  let n = 0
  for (const word of result.emulator.memory.slice(16384, 24576)) {
    let w = word & 0xffff
    while (w !== 0) { n += w & 1; w >>>= 1 }
  }
  return n
}

describe('Screen', () => {
  it('draws and erases one pixel', () => {
    const r = run(main('', `
      do Screen.drawPixel(3, 4);
      do Screen.drawPixel(500, 255);
    `))
    expect(pixel(r, 3, 4)).toBe(true)
    expect(pixel(r, 500, 255)).toBe(true)
    expect(pixel(r, 4, 4)).toBe(false)
    expect(blackPixels(r)).toBe(2)
  })

  it('fills a rectangle exactly', () => {
    // 10..40 across and 5..7 down is 31 by 3.
    const r = run(main('', 'do Screen.drawRectangle(10, 5, 40, 7);'))
    expect(blackPixels(r)).toBe(31 * 3)
    expect(pixel(r, 10, 5)).toBe(true)
    expect(pixel(r, 40, 7)).toBe(true)
    expect(pixel(r, 9, 5)).toBe(false)
    expect(pixel(r, 41, 7)).toBe(false)
    expect(pixel(r, 10, 8)).toBe(false)
  })

  it('erases in white what it drew in black', () => {
    const r = run(main('', `
      do Screen.drawRectangle(0, 0, 100, 100);
      do Screen.setColor(false);
      do Screen.drawRectangle(0, 0, 100, 100);
      do Screen.setColor(true);
    `))
    expect(blackPixels(r)).toBe(0)
  })

  it('clears the screen', () => {
    const r = run(main('', `
      do Screen.drawRectangle(0, 0, 511, 255);
      do Screen.clearScreen();
    `))
    expect(blackPixels(r)).toBe(0)
  })

  it('draws a horizontal, a vertical and a diagonal line', () => {
    const r = run(main('', `
      do Screen.drawLine(20, 30, 60, 30);
      do Screen.drawLine(100, 10, 100, 50);
      do Screen.drawLine(200, 100, 210, 110);
    `))
    expect(pixel(r, 20, 30)).toBe(true)
    expect(pixel(r, 60, 30)).toBe(true)
    expect(pixel(r, 61, 30)).toBe(false)
    expect(pixel(r, 100, 10)).toBe(true)
    expect(pixel(r, 100, 50)).toBe(true)
    expect(pixel(r, 200, 100)).toBe(true)
    expect(pixel(r, 210, 110)).toBe(true)
  })

  it('draws a circle inside its bounding box and nowhere else', () => {
    const r = run(main('', 'do Screen.drawCircle(100, 100, 20);'))
    expect(pixel(r, 100, 100)).toBe(true)
    expect(pixel(r, 120, 100)).toBe(true)
    expect(pixel(r, 100, 120)).toBe(true)
    expect(pixel(r, 121, 100)).toBe(false)
    expect(pixel(r, 115, 115)).toBe(false)
  })
})

describe('Output', () => {
  // The font is the course's, so the shapes are fixed and a count is a
  // meaningful assertion: a space must leave the screen blank and a letter
  // must not.
  it('leaves the screen blank for a space and marks it for a letter', () => {
    expect(blackPixels(run(main('', 'do Output.printChar(32);')))).toBe(0)
    expect(blackPixels(run(main('', 'do Output.printChar(65);')))).toBeGreaterThan(0)
  })

  it('puts a character in the frame the cursor names, and nowhere else', () => {
    const r = run(main('', `
      do Output.moveCursor(3, 5);
      do Output.printChar(66);
    `))
    // Row 3 is pixel rows 33..43; column 5 is pixel columns 40..47.
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 512; x++) {
        if (pixel(r, x, y)) {
          expect([x, y, y >= 33 && y < 44 && x >= 40 && x < 48]).toEqual([x, y, true])
        }
      }
    }
    expect(blackPixels(r)).toBeGreaterThan(0)
  })

  it('advances one column per character', () => {
    const one = run(main('', 'do Output.printChar(77);'))
    const two = run(main('', 'do Output.printString("MM");'))
    expect(blackPixels(two)).toBe(2 * blackPixels(one))
  })

  it('prints an integer as its digits', () => {
    const digits = run(main('', 'do Output.printInt(-407);'))
    const text = run(main('', 'do Output.printString("-407");'))
    expect(digits.emulator.memory.slice(16384, 24576)).toEqual(text.emulator.memory.slice(16384, 24576))
  })

  it('wraps to the next line past column 63', () => {
    const r = run(main('', `
      do Output.moveCursor(0, 63);
      do Output.printChar(88);
      do Output.printChar(88);
    `))
    // One in the last frame of row 0, one in the first frame of row 1.
    expect(pixel(r, 505, 5)).toBe(true)
    let onRow1 = false
    for (let y = 11; y < 22; y++) for (let x = 0; x < 8; x++) if (pixel(r, x, y)) onRow1 = true
    expect(onRow1).toBe(true)
  })

  it('backspace puts the cursor where the last character went', () => {
    const r = run(main('', `
      do Output.printChar(87);
      do Output.printChar(87);
      do Output.backSpace();
      do Output.printChar(32);
    `))
    const one = run(main('', 'do Output.printChar(87);'))
    expect(blackPixels(r)).toBe(blackPixels(one))
  })
})

describe('Keyboard', () => {
  it('reads the key the RAM says is down', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = Keyboard.keyPressed();')), { library: true })
    emulator.memory.set(24576, 81)
    for (let i = 0; i < 2_000_000 && emulator.running; i++) {
      if (emulator.at() === 'Sys.halt') break
      emulator.step()
    }
    expect(emulator.memory.get(emulator.globals().get('Main.a')!)).toBe(81)
  })

  // readChar waits for a press and then for a release, so the test has to
  // play the keyboard: hold a key, then let it go.
  it('reads a character once it is pressed and released', () => {
    const emulator = new Emulator()
    emulator.load(compile(main('static int a;', 'let a = Keyboard.readChar();')), { library: true })
    let pressedAt = 0
    for (let i = 0; i < 2_000_000 && emulator.running; i++) {
      if (emulator.at() === 'Sys.halt') break
      if (i === 200_000) { emulator.memory.set(24576, 75); pressedAt = i }
      if (pressedAt > 0 && i === pressedAt + 2000) emulator.memory.set(24576, 0)
      emulator.step()
    }
    expect(emulator.memory.get(emulator.globals().get('Main.a')!)).toBe(75)
  })
})
