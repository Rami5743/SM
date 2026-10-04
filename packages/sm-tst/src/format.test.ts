/**
 * The column format, checked against output the course's CPU emulator
 * actually produced. The strings on the right of each case were copied from
 * its .out files, not worked out from the manual, because the same .cmp has
 * to satisfy both tools and its comparison is exact.
 */
import { header, parseColumn, row } from './format.js'

const cols = (...specs: string[]) => specs.map(parseColumn)

describe('header', () => {
  it('matches what the course emits', () => {
    // Measured: `output-list RAM[16]%D1.6.1 RAM[17]%D2.3.2 RAM[16]%D0.8.0
    //            RAM[17]%B0.16.0 RAM[16]%X0.4.0`
    expect(header(cols('RAM[16]%D1.6.1', 'RAM[17]%D2.3.2', 'RAM[16]%D0.8.0', 'RAM[17]%B0.16.0', 'RAM[16]%X0.4.0')))
      .toBe('|RAM[16] |RAM[17]|RAM[16] |    RAM[17]     |RAM[|')
  })

  it('centres a short name with the odd space going right', () => {
    expect(header(cols('RAM[0]%D1.6.1'))).toBe('| RAM[0] |')
  })

  it('truncates a name too long for its field', () => {
    expect(header(cols('RAM[16]%X0.4.0'))).toBe('|RAM[|')
  })
})

describe('row', () => {
  const read = (a: number) => (a === 16 ? 7 : 100)

  it('matches what the course emits', () => {
    expect(row(cols('RAM[16]%D1.6.1', 'RAM[17]%D2.3.2', 'RAM[16]%D0.8.0', 'RAM[17]%B0.16.0', 'RAM[16]%X0.4.0'), read))
      .toBe('|      7 |  100  |       7|0000000001100100|0007|')
  })

  it('renders a negative in all three radices as the course does', () => {
    const negative = () => -5
    expect(row(cols('RAM[16]%D1.6.1'), negative)).toBe('|     -5 |')
    expect(row(cols('RAM[16]%X0.4.0'), negative)).toBe('|fffb|')
    expect(row(cols('RAM[16]%B0.16.0'), negative)).toBe('|1111111111111011|')
  })

  it('renders a large positive in hex as the course does', () => {
    expect(row(cols('RAM[17]%X0.4.0'), () => 3002)).toBe('|0bba|')
  })
})

describe('targets', () => {
  it('reads sp as RAM[0]', () => {
    expect(parseColumn('sp%D1.6.1').address).toBe(0)
  })

  it('refuses a name it does not know', () => {
    expect(() => parseColumn('frob%D1.6.1')).toThrow(/unknown target/)
  })
})
