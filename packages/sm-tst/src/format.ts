/**
 * The column format of a .tst output file.
 *
 * Measured against the course's CPU emulator rather than inferred, because
 * the same .cmp file has to be satisfied by both tools and its comparison is
 * exact: a single trailing space fails it ("Comparison failure at line 1").
 *
 * A spec is `%<F><L>.<W>.<R>` — format letter, then the padding on the left,
 * the width, and the padding on the right.
 *
 *   value   right-aligned in L+W, then R spaces
 *   header  the name centred in L+W+R, the odd space going right,
 *           truncated to that width if the name is longer
 *
 * D is signed decimal, X lowercase hex and B binary, both of them 16-bit
 * two's complement: -5 prints as `fffb` and `1111111111111011`.
 */
export type Radix = 'D' | 'B' | 'X'

export interface ColumnSpec {
  readonly title: string
  readonly address: number
  readonly radix: Radix
  readonly left: number
  readonly width: number
  readonly right: number
}

export function totalWidth(c: ColumnSpec): number {
  return c.left + c.width + c.right
}

export function header(columns: readonly ColumnSpec[]): string {
  return '|' + columns.map(headerCell).join('|') + '|'
}

function headerCell(c: ColumnSpec): string {
  const total = totalWidth(c)
  if (c.title.length >= total) return c.title.slice(0, total)
  const spare = total - c.title.length
  const left = Math.floor(spare / 2)
  return ' '.repeat(left) + c.title + ' '.repeat(spare - left)
}

export function row(columns: readonly ColumnSpec[], read: (address: number) => number): string {
  return '|' + columns.map((c) => valueCell(c, read(c.address))).join('|') + '|'
}

function valueCell(c: ColumnSpec, value: number): string {
  const text = render(c.radix, value)
  const field = c.left + c.width
  const body = text.length >= field ? text.slice(text.length - field) : text.padStart(field)
  return body + ' '.repeat(c.right)
}

function render(radix: Radix, value: number): string {
  const bits = value & 0xffff
  switch (radix) {
    case 'D': return String(value)
    case 'X': return bits.toString(16).padStart(4, '0')
    case 'B': return bits.toString(2).padStart(16, '0')
  }
}

/** `RAM[16]%D1.6.1`, or `sp`, which is RAM[0]. */
export function parseColumn(text: string): ColumnSpec {
  const m = /^(.+)%([DBX])(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (!m) throw new Error(`cannot read the output-list entry ${JSON.stringify(text)}`)
  return {
    title: m[1]!,
    address: addressOf(m[1]!),
    radix: m[2] as Radix,
    left: Number(m[3]),
    width: Number(m[4]),
    right: Number(m[5]),
  }
}

/** The names a script may use for a cell. */
export function addressOf(target: string): number {
  const ram = /^RAM\[(\d+)\]$/.exec(target)
  if (ram) return Number(ram[1])
  // `local` and `argument` are what the course's VM-emulator scripts call
  // the same two cells; a translated VM program reads them there.
  const named: Record<string, number> = {
    sp: 0, lcl: 1, local: 1, arg: 2, argument: 2, this: 3, that: 4,
  }
  const address = named[target.toLowerCase()]
  if (address === undefined) throw new Error(`unknown target ${JSON.stringify(target)}`)
  return address
}
