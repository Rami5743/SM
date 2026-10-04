/**
 * The Hack address space, as spec/sm.md section 2.1 lays it out.
 *
 * All of RAM is zero at reset. That is what the course's CPU emulator does —
 * measured, not assumed — and it is what makes a .cmp file reproducible: the
 * bootstrap pushes LCL before anything has set it, so without the rule that
 * cell holds whatever happened to be there.
 */
export const RAM_SIZE = 32768

export const ADDR = {
  SP: 0,
  LCL: 1,
  ARG: 2,
  THIS: 3,
  THAT: 4,
  /** The first register the runtime does not reserve. */
  STATIC_BASE: 16,
  STATIC_TOP: 255,
  STACK_BASE: 256,
  STACK_TOP: 2047,
  HEAP_BASE: 2048,
  HEAP_TOP: 16383,
  SCREEN_BASE: 16384,
  SCREEN_TOP: 24575,
  KEYBOARD: 24576,
} as const

/** The 16-bit word SM works in. Values are kept signed, as the Hack CPU has them. */
export function toWord(value: number): number {
  return (value << 16) >> 16
}

export class Memory {
  private readonly cells = new Int16Array(RAM_SIZE)

  get(address: number): number {
    if (address < 0 || address >= RAM_SIZE) {
      throw new RangeError(`address ${address} is outside RAM`)
    }
    return this.cells[address]!
  }

  set(address: number, value: number): void {
    if (address < 0 || address >= RAM_SIZE) {
      throw new RangeError(`address ${address} is outside RAM`)
    }
    this.cells[address] = toWord(value)
  }

  /** Zero every cell. */
  reset(): void {
    this.cells.fill(0)
  }

  /** A copy of a span, for a RAM dump or a screen hash. */
  slice(from: number, to: number): Int16Array {
    return this.cells.slice(from, to)
  }
}
