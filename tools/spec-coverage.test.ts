/**
 * M0's acceptance test: the normative reference covers every SM command.
 *
 * `reference/tst/all_cmds.sm` was supplied as one occurrence of every command
 * in the language, so it is the natural checklist of what has to be covered.
 * It is written in the notation the prototype had, so each of its lines is
 * matched to the spelling the reference gives that command now — by shape,
 * not by a literal search, because the reference writes them in tables with
 * metavariables.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const spec = readFileSync(join(root, 'spec/sm.md'), 'utf8')
const allCmds = readFileSync(join(root, 'reference/tst/all_cmds.sm'), 'utf8')

/** The reference's spelling of each command found in all_cmds.sm. */
const spelling: ReadonlyArray<readonly [RegExp, string]> = [
  [/^!.*\(.*\).*$/, '`function f(x1, x2, ...) locals y1, y2, ...`'],
  [/^\+$/, '`add`'],
  [/^-$/, '`sub`'],
  [/^&$/, '`and`'],
  [/^\|$/, '`or`'],
  [/^\(-\)$/, '`neg`'],
  [/^~$/, '`not`'],
  [/^>$/, '`gt`'],
  [/^<$/, '`lt`'],
  [/^==$/, '`eq`'],
  [/^\[\]$/, '`push-indirect`'],
  [/^->\[\]$/, '`pop-indirect`'],
  [/^<--$/, '`return`'],
  [/^<-[0-9]+$/, '`push 5`'],
  [/^<-@.+$/, '`push @x`'],
  [/^<-[A-Za-z].*$/, '`push x`'],
  [/^->@.+$/, '`pop @x`'],
  [/^->[A-Za-z].*$/, '`pop x`'],
  [/^.+:$/, '`label loop`'],
  [/^-->.+$/, '`goto loop`'],
  [/^\?-->.+$/, '`if-goto loop`'],
  [/^[A-Za-z][A-Za-z0-9.]*$/, '`call f`'],
]

/** Strip comments and all whitespace, exactly as the language says to. */
function clean(line: string): string {
  const noComment = line.includes('//') ? line.slice(0, line.indexOf('//')) : line
  return noComment.replace(/[ \t\r]/g, '')
}

function classify(cmd: string): string {
  for (const [shape, inSpec] of spelling) if (shape.test(cmd)) return inSpec
  throw new Error(`all_cmds.sm line not recognised by this test: ${cmd}`)
}

const commands = allCmds.split('\n').map(clean).filter((l: string) => l.length > 0)

describe('spec/sm.md', () => {
  it('finds at least one command per line of all_cmds.sm', () => {
    expect(commands.length).toBeGreaterThan(20)
  })

  // Order the longest spellings first so `<--` is not satisfied by `<-`.
  const wanted = [...new Set(commands.map(classify))].sort(
    (a: string, b: string) => b.length - a.length,
  )

  for (const spelling of wanted) {
    it(`documents ${spelling}`, () => {
      expect(spec).toContain(spelling)
    })
  }

  it('states where SP points', () => {
    expect(spec).toMatch(/`SP` holds the address of the \*\*first free cell\*\*/)
  })

  // Every decision recorded in CORRECTIONS.md must be visible in the reference,
  // so that a reader of one is never surprised by the other. The citation may
  // be parenthetical in prose or a cell in a table; either counts. C4 is the
  // one exception: C9 supersedes it, so the reference cites C9 instead.
  it.each(['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9'])('cites %s', (c) => {
    expect(spec).toMatch(new RegExp(`\\b${c}\\b`))
  })
})

/**
 * No document in spec/ may link to a file that is not there. Dangling links
 * are the way a set of documents rots quietly.
 */
describe('spec/ links', () => {
  const docs = readdirSync(join(root, 'spec')).filter((f) => f.endsWith('.md'))

  it.each(docs)('%s has no dangling relative link', (doc) => {
    const text = readFileSync(join(root, 'spec', doc), 'utf8')
    const targets = [...text.matchAll(/\]\((?!https?:)([^)#]+)/g)].map((m) => m[1]!)
    for (const target of targets) {
      expect(existsSync(join(root, 'spec', target)), `${doc} → ${target}`).toBe(true)
    }
  })
})
