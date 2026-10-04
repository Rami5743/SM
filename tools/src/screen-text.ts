/**
 * Reading the screen back as text.
 *
 * Several of the course's programs are checked by a person looking at the
 * screen — `ComplexArrays` prints the expected result beside the actual one
 * and asks you to compare them. A test can do the same if it can read what
 * was printed, and it can: `Output` draws from a character map that is
 * sitting in the heap, so the map inverted turns 8 by 11 pixels back into
 * the character that drew them.
 *
 * This is a test facility and nothing else. It belongs to no package, and
 * the emulator does not know it exists.
 */
import type { Emulator } from '@sm/emulator'

const SCREEN = 16384
const ROWS = 23
const COLUMNS = 64

/** The eleven rows of a frame, as one string, read off the screen. */
function frameAt(emulator: Emulator, row: number, column: number): string {
  const bits: number[] = []
  for (let line = 0; line < 11; line++) {
    const address = SCREEN + ((row * 11 + line) * 32) + (column >> 1)
    const word = emulator.memory.get(address) & 0xffff
    bits.push((column & 1) === 1 ? word >> 8 : word & 255)
  }
  return bits.join(',')
}

/** Character code to the eleven rows the library would draw for it. */
function fontFromHeap(emulator: Emulator): Map<string, number> {
  const charMaps = emulator.globals().get('Output.charMaps')
  if (charMaps === undefined) throw new Error('the program did not link Output')
  const base = emulator.memory.get(charMaps)
  const byShape = new Map<string, number>()
  for (let code = 126; code >= 32; code--) {
    const map = emulator.memory.get(base + code)
    if (map === 0) continue
    const bits: number[] = []
    for (let line = 0; line < 11; line++) bits.push(emulator.memory.get(map + line) & 255)
    // Lower codes win, so a shape shared by two characters reads as the
    // first of them. Nothing in the course's font shares one.
    byShape.set(bits.join(','), code)
  }
  return byShape
}

/**
 * The screen as 23 lines of text, trailing blanks removed. A frame that
 * matches no character reads as `?`.
 */
export function screenText(emulator: Emulator): string[] {
  const byShape = fontFromHeap(emulator)
  const blank = Array(11).fill(0).join(',')
  const lines: string[] = []
  for (let row = 0; row < ROWS; row++) {
    let line = ''
    for (let column = 0; column < COLUMNS; column++) {
      const shape = frameAt(emulator, row, column)
      if (shape === blank) { line += ' '; continue }
      const code = byShape.get(shape)
      line += code === undefined ? '?' : String.fromCharCode(code)
    }
    lines.push(line.replace(/ +$/, ''))
  }
  return lines
}

/** The lines that have anything on them. */
export function screenLines(emulator: Emulator): string[] {
  return screenText(emulator).filter((l) => l !== '')
}
