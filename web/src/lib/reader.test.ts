import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readerText } from './reader.js'

const spec = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'spec')

describe('the reference as a reader sees it', () => {
  for (const [file, afterAMark] of [
    ['sm.md', '`_` and `.`. Nothing else is a symbol.'],
    ['sm.he.md', '`_` ו‑`.`. שום דבר'],
  ] as const) {
    const source = readFileSync(join(spec, file), 'utf8')
    const read = readerText(source)

    it(`${file}: the correction marks are in the file and not on the page`, () => {
      expect(source).toMatch(/\(C\d\)/)
      expect(read).not.toMatch(/\bC\d\b/)
    })

    it(`${file}: the note about this project's own documents is not on the page`, () => {
      expect(read).not.toContain('CORRECTIONS.md')
      expect(read).not.toContain('INVENTORY.md')
      expect(read).not.toContain('../reference/')
    })

    it(`${file}: the language itself is untouched`, () => {
      // Every heading survives, and so does the text around a mark.
      const headings = (text: string) => text.split('\n').filter((l) => l.startsWith('#'))
      expect(headings(read)).toEqual(headings(source))
      expect(read).toContain(afterAMark)
    })

    it(`${file}: a table row keeps its columns`, () => {
      for (const line of read.split('\n')) {
        if (!line.startsWith('|')) continue
        expect([line, line.endsWith('|')]).toEqual([line, true])
      }
    })
  }

  it('leaves alone a parenthesis that is not a mark', () => {
    expect(readerText('the command `(-)` negates (see above)'))
      .toBe('the command `(-)` negates (see above)')
  })
})
