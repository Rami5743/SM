/**
 * `os/sm` and the module the emulator carries are generated from `os/jack`.
 * They are checked in so that nothing has to be compiled to build the site,
 * which means they can go stale. This is what notices.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildLibrary, libraryModule, OS_CLASSES } from './build-os.js'

const ROOT = join(import.meta.dirname, '..', '..')
const built = buildLibrary(join(ROOT, 'os', 'jack'))

describe('the checked-in library', () => {
  it('compiles with no warnings', () => {
    expect(built.warnings).toEqual([])
  })

  it('has all eight classes', () => {
    expect(Object.keys(built.sm).sort()).toEqual([...OS_CLASSES].sort())
  })

  for (const name of OS_CLASSES) {
    it(`os/sm/${name}.sm is current`, () => {
      expect(built.sm[name]).toBe(readFileSync(join(ROOT, 'os', 'sm', `${name}.sm`), 'utf8'))
    })
  }

  it('library.generated.ts is current', () => {
    expect(libraryModule(built))
      .toBe(readFileSync(join(ROOT, 'packages', 'sm-emulator', 'src', 'library.generated.ts'), 'utf8'))
  })
})
