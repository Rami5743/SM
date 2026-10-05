/**
 * M5's acceptance test, in a real browser.
 *
 * The site is built, served, and driven. What is checked is what the
 * bilingual decision actually costs: that Hebrew is the default and
 * right-to-left, that the language switch keeps the reader on the page, that
 * every tab is reachable from every page, and above all that code is marked
 * left-to-right — on a right-to-left page an unmarked listing has its `@`
 * jump to the far end, which is the failure this whole rule exists for.
 */
import { createServer, type Server } from 'node:http'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { globSync } from 'node:fs'

const web = fileURLToPath(new URL('.', import.meta.url)) + '..'
const dist = join(web, 'dist')

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
}

let server: Server
let browser: Browser
let origin: string

beforeAll(async () => {
  execFileSync('npx', ['vite', 'build'], { cwd: web, stdio: 'pipe' })

  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!))
    let file = join(dist, path)
    // A static host serves 404.html for an unknown path; so do we, which is
    // what makes a deep link work.
    if (!existsSync(file) || path.endsWith('/')) file = join(dist, 'index.html')
    if (!existsSync(file)) file = join(dist, '404.html')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`

  // The container ships a Chromium of its own, whose build number need not
  // match the one this Playwright would fetch, and whose layout differs
  // between builds. Find it rather than download anything; if it is not
  // there, let the launch fail loudly rather than quietly skipping the only
  // test that drives the real page.
  const [chrome] = globSync('/opt/pw-browsers/chromium-*/chrome-linux*/chrome')
  browser = await chromium.launch(chrome === undefined ? {} : { executablePath: chrome })
}, 180_000)

afterAll(async () => {
  await browser?.close()
  server?.close()
})

async function open(path: string): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(origin + path)
  await page.waitForSelector('header')
  return page
}

describe('the shell', () => {
  it('serves Hebrew at the root, right to left', async () => {
    const page = await open('/')
    expect(await page.getAttribute('html', 'lang')).toBe('he')
    expect(await page.getAttribute('html', 'dir')).toBe('rtl')
    await page.close()
  })

  it('serves English at /en/, left to right', async () => {
    const page = await open('/en/')
    expect(await page.getAttribute('html', 'lang')).toBe('en')
    expect(await page.getAttribute('html', 'dir')).toBe('ltr')
    await page.close()
  })

  it('gathers every page on the home page', async () => {
    const page = await open('/')
    const cards = await page.$$eval('.cards .card h3', (hs) => hs.map((h) => h.textContent))
    expect(cards).toEqual(['אמולטור', 'קומפיילר', 'גשר', 'תיעוד', 'רציונל', 'משימות'])
    await page.close()
  })

  it('reaches every tab from every page', async () => {
    const page = await open('/')
    for (const tab of ['אמולטור', 'קומפיילר', 'גשר', 'תיעוד', 'רציונל', 'משימות', 'ראשי']) {
      await page.click(`nav a:text-is("${tab}")`)
      await page.waitForSelector(`nav a[aria-current="page"]:text-is("${tab}")`)
    }
    await page.close()
  })

  it('keeps the page when the language is switched', async () => {
    const page = await open('/')
    await page.click('nav a:text-is("רציונל")')
    await page.click('.langs a[lang="en"]')
    expect(new URL(page.url()).pathname).toBe('/en/rationale')
    await page.waitForSelector('nav a[aria-current="page"]:text-is("Rationale")')
    await page.close()
  })

  it('serves each document in one language only, in its own direction', async () => {
    for (const [path, dir, has, hasNot] of [
      ['/reference', 'rtl', 'שפת SM', 'The SM language'],
      ['/en/reference', 'ltr', 'The SM language', 'שפת SM'],
      // The page is the language; the correction marks stay in the file.
      ['/en/reference', 'ltr', 'Nothing else is a symbol', 'CORRECTIONS.md'],
      ['/rationale', 'rtl', 'בעבודה', 'Work in progress'],
      ['/en/rationale', 'ltr', 'Work in progress', 'בעבודה'],
    ] as const) {
      const page = await open(path)
      expect([path, await page.getAttribute('article', 'dir')]).toEqual([path, dir])
      const text = await page.textContent('article')
      expect([path, text?.includes(has)]).toEqual([path, true])
      expect([path, text?.includes(hasNot)]).toEqual([path, false])
      await page.close()
    }
  })

  // A Latin run of several words with punctuation around it is reordered
  // inside a Hebrew paragraph, so the citation stands on its own and says
  // which way it runs.
  it('marks the one Latin passage of the Hebrew reference left to right', async () => {
    const page = await open('/reference')
    const dirs = await page.$$eval('article p[dir]', (ps) => ps.map((p) => p.getAttribute('dir')))
    expect(dirs).toEqual(['ltr'])
    expect(await page.textContent('article p[dir=ltr]')).toContain('Nisan and S. Schocken')
    await page.close()
  })
})

describe('direction', () => {
  // The rule the whole bilingual decision turns on.
  it('marks every code pane left-to-right on the Hebrew side', async () => {
    const page = await open('/emulator')
    const dirs = await page.$$eval(
      '.listing, textarea, table.cells, pre',
      (nodes) => nodes.map((n) => n.getAttribute('dir')),
    )
    expect(dirs.length).toBeGreaterThan(2)
    expect(dirs.every((d) => d === 'ltr')).toBe(true)
    await page.close()
  })

  it('renders a listing in source order, not reversed', async () => {
    const page = await open('/emulator')
    const first = await page.textContent('.listing .line')
    expect(first?.trim()).toBe('<-7')
    await page.close()
  })
})

describe('the emulator page', () => {
  it('offers exactly the eleven tests of the two packages, in their order', async () => {
    const page = await open('/emulator')
    const options = await page.$$eval('.controls select >> nth=0 >> option',
      (os) => os.map((o) => o.textContent))
    expect(options).toEqual([
      '07-sm · SimpleAdd', '07-sm · StackTest', '07-sm · GlobalTest',
      '07-sm · PointerTest', '07-sm · StaticTest',
      '08-sm · BasicLoop', '08-sm · FibonacciSeries', '08-sm · SimpleFunction',
      '08-sm · NestedCall', '08-sm · StaticsTest', '08-sm · FibonacciElement',
    ])
    await page.close()
  })

  it('runs FibonacciElement, which bootstraps, from a cold load', async () => {
    const page = await open('/emulator')
    await page.selectOption('.controls select >> nth=0', { label: '08-sm · FibonacciElement' })
    await page.click('button:text-is("הרץ")')
    await page.waitForSelector('.status:text-matches("נעצר")')
    // Sys.init returns the answer, which lands at the base of the stack.
    const rows = await page.$$eval('.panel:has(h3:text-is("מחסנית")) table.cells tr td',
      (tds) => tds.map((t) => t.textContent))
    expect(rows).toEqual(['256', '8'])
    await page.close()
  })

  it('marks the line the program counter is on, and moves it on a step', async () => {
    const page = await open('/emulator')
    expect(await page.textContent('.listing .line.here')).toBe('<-7')
    await page.click('button:text-is("צעד")')
    expect(await page.textContent('.listing .line.here')).toBe('<-8')
    await page.click('button:text-is("צעד")')
    expect(await page.textContent('.listing .line.here')).toBe('+')
    await page.close()
  })

  it('reports a bad program with a line number instead of running it', async () => {
    const page = await open('/emulator')
    await page.fill('textarea', '!f()\n-->Nowhere\n<--')
    await page.waitForSelector('.fault:text-matches("unknown label")')
    expect(await page.textContent('.fault')).toContain('in line 2')
    await page.close()
  })

  it('renders the same program in words when asked', async () => {
    const page = await open('/emulator')
    await page.selectOption('.controls select >> nth=1', 'words')
    await page.selectOption('.controls select >> nth=0', { label: '08-sm · BasicLoop' })
    const text = await page.textContent('.listing')
    expect(text).toContain('if-goto')
    expect(text).toContain('goto')
    // C4: the operators stay symbolic in every view.
    expect(text).toContain('+')
    expect(text).not.toContain('add')
    await page.close()
  })
})

describe('the compiler page', () => {
  it('compiles Jack to SM as you type', async () => {
    const page = await open('/compiler')
    const sm = await page.textContent('.panel:has(h3:text-is("הפלט ב‑SM")) pre')
    expect(sm).toContain('!Main.main()i,sum')
    expect(sm).toContain('Math.multiply')
    expect(await page.textContent('.fault')).toBe('')
    await page.close()
  })

  // The check the course's compiler performs and the prototype does not.
  it('rejects a subroutine control can fall out of, naming the line', async () => {
    const page = await open('/compiler')
    await page.selectOption('select', '2')
    await page.waitForSelector('.fault:text-matches("without .return.")')
    expect(await page.textContent('.fault')).toContain('In subroutine f')
    await page.close()
  })
})

describe('a compiled Jack program, end to end in the browser', () => {
  it('goes from the compiler page to the emulator, links the library and draws', async () => {
    const page = await open('/compiler')
    await page.fill('textarea',
      'class Main { function void main() { do Output.printString("SM"); return; } }')
    await page.waitForSelector('.panel:has(h3) pre:text-matches("Output.printString")')
    await page.click('button:text-is("שלח לאמולטור")')
    await page.waitForSelector('canvas.screen')
    // The library is linked because the program has Main.main and no
    // Sys.init: that is the whole rule, and the status line says so.
    await page.waitForSelector('.status:text-matches("ספרייה")')
    await page.click('button:text-is("הרץ")')
    const black = await page.$eval('canvas.screen', (canvas) => {
      const context = (canvas as HTMLCanvasElement).getContext('2d')
      if (context === null) return -1
      const { data } = context.getImageData(0, 0, 512, 256)
      let n = 0
      for (let i = 0; i < data.length; i += 4) if (data[i] === 0) n++
      return n
    })
    expect(black).toBeGreaterThan(0)
    await page.close()
  })
})

describe('the bridge page', () => {
  it('reads a course .vm file as SM', async () => {
    const page = await open('/bridge')
    const sm = await page.textContent('.panel:has(h3:text-is("התוצאה")) pre')
    // `eq` has to leave all ones or zero, which SM reaches through a branch.
    expect(sm).toContain('<-17')
    expect(sm).toContain('==')
    expect(sm).toContain('?-->vm.true.0')
    // `pop this 0` through an address, with the value stepping aside.
    expect(sm).toContain('->[]')
    await page.close()
  })

  it('writes SM as .vm, split by class', async () => {
    const page = await open('/bridge')
    await page.selectOption('.controls select', 'sm-to-vm')
    await page.waitForSelector('pre:text-matches("function Sys.init")')
    const vm = await page.textContent('.panel:has(h3:text-is("התוצאה")) pre')
    // The course's VM emulator insists that Sys.init live in Sys.vm.
    expect(vm).toContain('// Sys.vm')
    expect(vm).toContain('// Main.vm')
    // `<` is a subtraction, which is what SM says it is.
    expect(vm).toContain('sub')
    expect(vm).toContain('push constant 0\n  lt\n  if-goto done')
    await page.close()
  })

  // A `static i` belongs to its file, so several files is not the same as
  // one concatenation, and the page keeps them apart.
  it('imports a folder of .vm files and keeps each file\'s statics its own', async () => {
    const page = await open('/bridge')
    await page.setInputFiles('.opener:has-text("טען קובץ") input', [
      { name: 'Class1.vm', mimeType: 'text/plain', buffer: Buffer.from('function Class1.get 0\npush static 0\nreturn\n') },
      { name: 'Class2.vm', mimeType: 'text/plain', buffer: Buffer.from('function Class2.get 0\npush static 0\nreturn\n') },
    ])
    await page.waitForSelector('pre:text-matches("Class1.0")')
    const sm = await page.textContent('.panel:has(h3:text-is("התוצאה")) pre')
    expect(sm).toContain('<-Class1.0')
    expect(sm).toContain('<-Class2.0')
    await page.close()
  })

  it('reports a bad VM command with a line number', async () => {
    const page = await open('/bridge')
    await page.fill('textarea', 'push constant 1\nwobble\n')
    await page.waitForSelector('.fault:text-matches("not a VM command")')
    expect(await page.textContent('.fault')).toContain('in line 2')
    await page.close()
  })
})

describe('a program in the address bar', () => {
  it('comes back from the link', async () => {
    const page = await open('/emulator')
    await page.fill('textarea', '<-7\n<-8\n+\n')
    await page.click('button:text-is("העתק קישור")')
    await page.waitForSelector('.notice:text-is("הקישור הועתק.")')
    const url = page.url()
    expect(url).toContain('#p=')

    const reopened = await browser.newPage()
    await reopened.goto(url)
    await reopened.waitForSelector('textarea')
    expect(await reopened.inputValue('textarea')).toBe('<-7\n<-8\n+\n')
    await reopened.close()
    await page.close()
  })
})

describe('opening a program from disk', () => {
  /** A webkitdirectory input takes a path, not buffers, so make one. */
  function folder(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'sm-open-'))
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    return dir
  }

  it('the emulator takes a whole test folder, and puts only the .sm in the box', async () => {
    const page = await open('/emulator')
    await page.setInputFiles('.opener:has-text("טען תיקייה") input', folder({
      'Sys.sm': '!Sys.init()\n<-9\nMain.twice\n<--\n',
      'Main.sm': '!Main.twice(n)\n<-@n\n<-@n\n+\n<--\n',
      'notes.txt': 'not a program',
    }))
    await page.waitForSelector('textarea')
    const text = await page.inputValue('textarea')
    expect(text).toContain('// Main.sm')
    expect(text).toContain('// Sys.sm')
    expect(text).not.toContain('not a program')

    // And it is a program, not just text: it runs and returns 18.
    await page.click('button:text-is("הרץ")')
    await page.waitForSelector('.status:text-matches("נעצר")')
    const rows = await page.$$eval('.panel:has(h3:text-is("מחסנית")) table.cells tr td',
      (tds) => tds.map((t) => t.textContent))
    expect(rows).toEqual(['256', '18'])
    await page.close()
  })

  it('the bridge takes a folder of .vm files', async () => {
    const page = await open('/bridge')
    await page.setInputFiles('.opener:has-text("טען תיקייה") input', folder({
      'Class1.vm': 'function Class1.get 0\npush static 3\nreturn\n',
    }))
    await page.waitForSelector('pre:text-matches("Class1.3")')
    await page.close()
  })
})

describe('taking the exercises away', () => {
  it('downloads both packages as one zip, without the files a run produces', async () => {
    const page = await open('/projects')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:text-is("הורד את שתי התיקיות")'),
    ])
    expect(download.suggestedFilename()).toBe('sm-projects.zip')

    const work = mkdtempSync(join(tmpdir(), 'sm-zip-'))
    try {
      const file = join(work, 'projects.zip')
      await download.saveAs(file)
      const names: string[] = JSON.parse(execFileSync('python3', ['-c', [
        'import json,sys,zipfile',
        'z = zipfile.ZipFile(sys.argv[1])',
        'assert z.testzip() is None',
        'print(json.dumps(sorted(z.namelist())))',
      ].join('\n'), file], { encoding: 'utf8' }))

      expect(names).toContain('07-sm/README.md')
      expect(names).toContain('07-sm/SimpleAdd/SimpleAdd.sm')
      expect(names).toContain('07-sm/SimpleAdd/SimpleAddSM.tst')
      expect(names).toContain('07-sm/SimpleAdd/SimpleAdd.cmp')
      expect(names).toContain('08-sm/README.md')
      expect(names).toContain('08-sm/FibonacciElement/Sys.sm')
      // A .out is what running the test produces; shipping one would let a
      // test look satisfied before it has run.
      expect(names.filter((n) => n.endsWith('.out'))).toEqual([])
      // Both packages whole: every tracked file but the outputs.
      expect(names.length).toBe(60)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('the test runner on the emulator page', () => {
  // The eleven tests of both packages, run here the way a student runs
  // them, each against its own compare file. This is also what the first
  // four of part II need: they expect a frame a caller would have left, and
  // the script is what plants it.
  it('runs every example against its own compare file', async () => {
    const page = await open('/emulator')
    const labels = await page.$$eval('.controls select >> nth=0 >> option',
      (os) => os.map((o) => o.textContent ?? ''))
    expect(labels.length).toBe(11)

    for (const label of labels) {
      await page.selectOption('.controls select >> nth=0', { label })
      await page.click('button:text-is("הרץ את הבדיקה")')
      await page.waitForSelector('.panel:has(h3:text-is("הפלט")) .notice:text-is("ההשוואה עברה.")',
        { timeout: 20_000 })
      expect([label, await page.textContent('.fault')]).toEqual([label, ''])
    }
    await page.close()
  })

  it('leaves the machine holding what the test left behind', async () => {
    const page = await open('/emulator')
    await page.selectOption('.controls select >> nth=0', { label: '08-sm · BasicLoop' })
    await page.click('button:text-is("הרץ את הבדיקה")')
    await page.waitForSelector('.notice:text-is("ההשוואה עברה.")')
    // BasicLoop sums 1..6 into RAM[310], which is where the script put its
    // argument. The stack panel shows the machine the script drove.
    const output = await page.textContent('.panel:has(h3:text-is("הפלט")) pre')
    expect(output).toContain('21')
    await page.close()
  })

  it('says so when a program and its compare file disagree', async () => {
    const page = await open('/emulator')
    await page.fill('textarea >> nth=0', '<-7\n<-8\n-\n')
    await page.click('button:text-is("הרץ את הבדיקה")')
    await page.waitForSelector('.notice:text-matches("ההשוואה נכשלה בשורה")')
    await page.close()
  })
})

/**
 * Direction, measured rather than eyeballed.
 *
 * On a Hebrew page the bidirectional algorithm decides where every neutral
 * character goes, and a token made only of neutrals — `[]`, `->[]`, `<--`,
 * `(-)`, `0..32767` — takes the direction of the paragraph around it. The
 * test asks the browser for the box of every single character and compares
 * the order the characters are painted in with the order they were written
 * in. Anything that must read left to right has to match exactly.
 */
const DIRECTION_AUDIT = () => {
  const charBoxes = (node: Text) => {
    const text = node.textContent ?? ''
    const out: Array<{ x: number; y: number; c: string; i: number }> = []
    for (let i = 0; i < text.length; i++) {
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const box = range.getBoundingClientRect()
      out.push({ x: box.left, y: Math.round(box.top), c: text[i]!, i })
    }
    return out
  }
  const problems: Array<{ kind: string; logical: string; visual: string }> = []

  // Anything that must read left to right, whole and in order.
  const seen = new Set<string>()
  const mustBeLtr = 'code, pre, .code, .listing .line, table.cells td, [dir="ltr"]'
  for (const el of Array.from(document.querySelectorAll(mustBeLtr))) {
    if (el.children.length > 0) continue
    const node = el.firstChild
    if (node === null || node.nodeType !== Node.TEXT_NODE) continue
    const text = node.textContent ?? ''
    if (text.trim() === '' || text.length > 120 || seen.has(text)) continue
    seen.add(text)
    const lines = new Map<number, ReturnType<typeof charBoxes>>()
    for (const ch of charBoxes(node as Text)) {
      if (!lines.has(ch.y)) lines.set(ch.y, [])
      lines.get(ch.y)!.push(ch)
    }
    for (const chars of lines.values()) {
      const visual = [...chars].sort((a, b) => a.x - b.x).map((c) => c.c).join('')
      const logical = [...chars].sort((a, b) => a.i - b.i).map((c) => c.c).join('')
      if (visual !== logical) problems.push({ kind: 'reversed', logical, visual })
    }
  }

  // A Latin or numeric run inside Hebrew prose must stay in one piece and in
  // order: `07-sm` must not come out `sm-07`.
  const hebrew = /[֐-׿]/
  const run = /[A-Za-z0-9][A-Za-z0-9._‑-]*[A-Za-z0-9]/g
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const done = new Set<string>()
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (!hebrew.test(text) || text.length > 200) continue
    if (node.parentElement?.closest('code, pre, .code') != null) continue
    for (const match of text.matchAll(run)) {
      const token = match[0]
      if (token.length < 2 || done.has(token)) continue
      done.add(token)
      const chars = charBoxes(node as Text).slice(match.index, match.index + token.length)
      if (new Set(chars.map((c) => c.y)).size > 1) continue
      const visual = [...chars].sort((a, b) => a.x - b.x).map((c) => c.c).join('')
      if (visual !== token) problems.push({ kind: 'split', logical: token, visual })
    }
  }
  return problems
}

describe('direction, character by character', () => {
  for (const path of ['/', '/emulator', '/compiler', '/bridge', '/reference', '/rationale', '/projects']) {
    it(`${path} paints every left-to-right run in the order it was written`, async () => {
      const page = await open(path)
      expect([path, await page.evaluate(DIRECTION_AUDIT)]).toEqual([path, []])
      await page.close()
    })
  }

  // The same audit cannot reach an <option>: the browser paints the chosen
  // one itself, outside the layout. So the structural rule is checked
  // instead — a list of Latin labels is marked left to right, or `07-sm ·
  // SimpleAdd` comes out `sm · SimpleAdd-07`.
  it('marks a select whose options are Latin', async () => {
    for (const path of ['/emulator', '/compiler', '/bridge']) {
      const page = await open(path)
      const selects = await page.$$eval('.controls select', (nodes) => nodes.map((node) => {
        const select = node as HTMLSelectElement
        const labels = Array.from(select.options).map((o) => o.textContent ?? '')
        return {
          dir: select.getAttribute('dir'),
          latin: labels.every((label) => /^[\x20-\x7E]+$/.test(label)),
          labels,
        }
      }))
      expect(selects.length).toBeGreaterThan(0)
      for (const select of selects) {
        if (select.latin) expect([path, select.labels, select.dir]).toEqual([path, select.labels, 'ltr'])
      }
      await page.close()
    }
  })

  // And the proof that the audit bites: take the isolation away and the
  // reference page fails on the operators and the address ranges.
  it('fails when the isolation is removed', async () => {
    const page = await open('/reference')
    await page.addStyleTag({ content: 'code, .code, pre, .cells { unicode-bidi: normal !important; }' })
    const problems = await page.evaluate(DIRECTION_AUDIT)
    expect(problems.length).toBeGreaterThan(10)
    expect(problems.map((p) => `${p.logical} -> ${p.visual}`)).toContain('<-@x -> x@-<')
    expect(problems.map((p) => `${p.logical} -> ${p.visual}`)).toContain('0..32767 -> 32767..0')
    await page.close()
  })
})
