/**
 * The parser, against the course's own project 10 compare files.
 *
 * Seven class files in three sets, with expected XML we did not write and
 * cannot have biased. This is the whole reason the front end is cheap to
 * trust: the grammar is the course's, so its tests are ours.
 *
 * The corpus is not checked in — it is the course's material, and the suite
 * reaches it where the course tools are installed, the same arrangement the
 * assembler tests already use. The round trip below runs everywhere.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classToXml } from './xml.js'
import { parseClass } from './parse.js'
import { tokenize, tokensToXml } from './token.js'

const PROJECT_10 = '/home/user/tcarreira/nand2tetris/projects/10'
const COURSE_TOOLS = '/home/user/tcarreira/nand2tetris/tools'
const havePr10 = existsSync(PROJECT_10)
const haveComparer = existsSync(join(COURSE_TOOLS, 'TextComparer.sh'))

const sets = havePr10 ? readdirSync(PROJECT_10).sort() : []

describe.skipIf(!havePr10)("the course's project 10 corpus", () => {
  for (const set of sets) {
    const classes = readdirSync(join(PROJECT_10, set)).filter((f) => f.endsWith('.jack')).sort()
    describe(set, () => {
      for (const file of classes) {
        const base = file.replace(/\.jack$/, '')
        const source = () => readFileSync(join(PROJECT_10, set, file), 'utf8')
        // The course's files are checked in with CRLF; ours are written with
        // LF. That is the only difference the comparison is asked to forgive.
        const expected = (name: string) =>
          readFileSync(join(PROJECT_10, set, name), 'utf8').replace(/\r\n/g, '\n')

        it(`${base}: the token stream matches ${base}T.xml`, () => {
          expect(tokensToXml(tokenize(file, source())))
            .toBe(expected(`${base}T.xml`))
        })

        it(`${base}: the tree matches ${base}.xml`, () => {
          expect(classToXml(parseClass(file, source())))
            .toBe(expected(`${base}.xml`))
        })
      }
    })
  }

  // Exact equality above is stricter than the course asks for. This is the
  // comparison the course itself performs, run with its own tool, so that
  // "passes project 10" means what it means to a student.
  it.skipIf(!haveComparer)("passes the course's own TextComparer", () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-pr10-'))
    try {
      for (const set of sets) {
        for (const file of readdirSync(join(PROJECT_10, set)).filter((f) => f.endsWith('.jack'))) {
          const base = file.replace(/\.jack$/, '')
          const source = readFileSync(join(PROJECT_10, set, file), 'utf8')
          writeFileSync(join(work, `${set}.${base}.xml`), classToXml(parseClass(file, source)))
          writeFileSync(join(work, `${set}.${base}T.xml`), tokensToXml(tokenize(file, source)))
          for (const suffix of ['', 'T']) {
            execFileSync('sh', [
              join(COURSE_TOOLS, 'TextComparer.sh'),
              join(PROJECT_10, set, `${base}${suffix}.xml`),
              join(work, `${set}.${base}${suffix}.xml`),
            ], { stdio: 'pipe' })
          }
        }
      }
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('the tree prints back to its own source', () => {
  // What this covers that the corpus does not: it runs without the course
  // installed, and it holds the printer honest on the one thing the tree
  // could have thrown away — parentheses, which Jack needs because it has no
  // precedence at all.
  const CASES = [
    'class A { function int f() { return 1 + 2 * 3; } }',
    'class A { function int f() { return (1 + 2) * 3; } }',
    'class A { function int f() { return 1 + (2 * 3); } }',
    'class A { function int f() { return -(1 - 2); } }',
    'class A { function int f() { return ~((1 < 2) & (3 > 4)); } }',
    'class A { static int n; field char c, d;' +
    ' constructor A new() { var Array a; let a = Array.new(2); let a[0] = n;' +
    ' if (c = d) { do Output.printString("hi & bye"); } else { return this; }' +
    ' while (~(n > 0)) { let n = n - 1; } return this; } }',
  ]

  // Printing the tree and tokenizing the print must give the same token
  // stream as tokenizing the source: nothing added, nothing lost, nothing
  // reordered.
  for (const source of CASES) {
    it(source.slice(0, 48), () => {
      const xml = classToXml(parseClass('A.jack', source))
      const printed = [...xml.matchAll(/^ *<(keyword|symbol|integerConstant|stringConstant|identifier)> (.*) <\/\1>$/gm)]
        .map((m) => `${m[1]} ${m[2]}`)
      const expected = tokenize('A.jack', source).map((t) => {
        const text = t.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        return `${t.kind} ${text}`
      })
      expect(printed).toEqual(expected)
    })
  }
})
