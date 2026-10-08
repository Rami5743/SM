/**
 * The zip writer, read back by something that is not us.
 *
 * Writing the format by hand is only defensible if a real unzip can open
 * the result, so that is the test: Python's `zipfile`, which checks the
 * central directory and every CRC.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zip } from './zip.js'

describe('zip', () => {
  it('writes an archive Python can open, names, contents and all', async () => {
    const files = {
      'Main.sm': 'function Sys.init()\npush 7\nreturn\n',
      'nested/Other.sm': '!f(a)\n<-@a\n<--\n',
      // Hebrew, to be sure the sizes are the bytes and not the characters.
      'readme.txt': 'שלום\n',
    }
    const bytes = Buffer.from(await zip(files).arrayBuffer())
    const work = mkdtempSync(join(tmpdir(), 'sm-zip-'))
    try {
      writeFileSync(join(work, 'out.zip'), bytes)
      const listing = execFileSync('python3', ['-c', [
        'import json,sys,zipfile',
        'z = zipfile.ZipFile(sys.argv[1])',
        'assert z.testzip() is None',
        'print(json.dumps({n: z.read(n).decode() for n in z.namelist()}))',
      ].join('\n'), join(work, 'out.zip')], { encoding: 'utf8' })
      expect(JSON.parse(listing)).toEqual(files)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('writes an empty archive without complaint', async () => {
    expect((await zip({}).arrayBuffer()).byteLength).toBe(22)
  })
})
