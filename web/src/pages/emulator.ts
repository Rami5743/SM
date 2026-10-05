/**
 * The emulator page: a program, the stack, the frames, the globals, the RAM.
 *
 * Everything that shows a program or a number is marked left-to-right, which
 * on the Hebrew side is the difference between a readable listing and a
 * scrambled one.
 */
import { parse, printCommand, resolve, type SmFile, type Notation } from '@sm/core'
import { ADDR, Emulator, planFor, SmFault, standardLibrary, withLibrary } from '@sm/emulator'
import { el } from '../lib/dom.js'
import type { Strings } from '../lib/i18n.js'
import { HANDOFF } from './compiler.js'
import { screenView } from '../lib/screen.js'
import { fileOpener, type Opened } from '../lib/open-files.js'
import { EXAMPLES } from '../lib/packages.js'
import { shareLink, sharedProgram } from '../lib/share.js'
import { download } from '../lib/zip.js'

export function emulatorPage(s: Strings): HTMLElement {
  const root = el('div')
  const source = el('textarea', { spellcheck: 'false', dir: 'ltr' })
  source.value = EXAMPLES[0]!.source

  const emulator = new Emulator()
  let files: SmFile[] = []
  let notation: Notation = 'mnemonic'
  let fault = ''
  let libraryLinked = false

  const listing = el('div', { class: 'listing code', dir: 'ltr' })
  const stackBody = el('div', { class: 'body' })
  const framesBody = el('div', { class: 'body' })
  const globalsBody = el('div', { class: 'body' })
  const status = el('span', { class: 'status' })
  const screen = screenView(emulator)
  const faultLine = el('div', { class: 'fault' })
  const noticeLine = el('div', { class: 'notice' })

  // Several .sm files concatenate without ceremony: a file is only a
  // container, and function names are global to the program, so one box can
  // hold a whole program however it arrived.
  const opened = (files: readonly Opened[]): void => {
    source.value = files.length === 1
      ? files[0]!.text
      : files.map((f) => `// ${f.name}\n${f.text.replace(/\n*$/, '\n')}`).join('\n')
    load()
  }
  const openFiles = fileOpener({ extension: '.sm', folder: false, label: s.openFiles, onOpen: opened })
  const openFolder = fileOpener({ extension: '.sm', folder: true, label: s.openFolder, onOpen: opened })

  const shareBtn = el('button', {}, s.copyLink)
  const downloadBtn = el('button', {}, s.download)
  const stepBtn = el('button', {}, s.step)
  const runBtn = el('button', {}, s.run)
  const resetBtn = el('button', {}, s.reset)

  const notationSelect = el('select')
  notationSelect.append(
    el('option', { value: 'mnemonic' }, s.mnemonics),
    el('option', { value: 'words' }, s.words),
  )
  notationSelect.addEventListener('change', () => {
    notation = notationSelect.value as Notation
    draw()
  })

  const examples = el('select')
  for (const [i, ex] of EXAMPLES.entries()) examples.append(el('option', { value: String(i) }, ex.label))
  examples.value = '0'
  examples.addEventListener('change', () => {
    source.value = EXAMPLES[Number(examples.value)]!.source
    load()
  })

  function load(): void {
    fault = ''
    const r = parse('program.sm', source.value)
    const problems = [...r.diagnostics]
    if (problems.length > 0) {
      fault = problems.map((d) => `program.sm: in line ${d.pos.line}: ${d.message}`).join('\n')
      files = []
      draw()
      return
    }
    files = [r.file]
    // One rule for how a program wants to be loaded, the same one the .tst
    // runner uses: see planFor.
    const plan = planFor(files)
    const all = plan.library
      ? withLibrary(files, standardLibrary(), { seed: plan.entry === 'bootstrap' ? ['Sys.init'] : [] })
      : files
    const unresolved = resolve({ files: all })
    if (unresolved.length > 0) {
      fault = unresolved.map((d) => `${d.pos.file}: in line ${d.pos.line}: ${d.message}`).join('\n')
      files = []
      draw()
      return
    }
    libraryLinked = plan.library
    try {
      emulator.load(all, { allowFragment: plan.allowFragment, entry: plan.entry })
    } catch (error) {
      fault = error instanceof SmFault ? error.message : String(error)
    }
    draw()
  }

  function guard(action: () => void): void {
    try {
      action()
    } catch (error) {
      fault = error instanceof SmFault ? error.message : String(error)
    }
    draw()
  }

  stepBtn.addEventListener('click', () => guard(() => emulator.step()))
  runBtn.addEventListener('click', () => guard(() => emulator.run(500_000)))
  resetBtn.addEventListener('click', () => { fault = ''; load() })
  source.addEventListener('input', load)

  // The program travels in the fragment, which never reaches a server, so
  // a link carries the whole thing and there is nothing to host.
  shareBtn.addEventListener('click', () => {
    const link = shareLink(source.value)
    history.replaceState(null, '', link)
    void navigator.clipboard?.writeText(link)
    noticeLine.textContent = s.copied
  })
  downloadBtn.addEventListener('click', () => download('program.sm', source.value))

  function draw(): void {
    faultLine.textContent = fault
    noticeLine.textContent = ''
    status.textContent = `${emulator.steps} ${s.steps}`
      + (emulator.running ? '' : ` · ${s.halted}`)
      + (libraryLinked ? ` · ${s.library} ${s.libraryOn}` : '')
    stepBtn.disabled = !emulator.running
    runBtn.disabled = !emulator.running

    // One line per step, in the order the steps were laid out, so that the
    // program counter names a line. The library is linked after these, so a
    // step inside it falls past the end and nothing is marked.
    listing.replaceChildren()
    let here: HTMLElement | undefined
    for (const [index, text] of listingLines(files, notation).entries()) {
      const line = el('div', { class: 'line' }, text)
      if (index === emulator.programCounter) {
        line.classList.add('here')
        here = line
      }
      listing.append(line)
    }
    here?.scrollIntoView({ block: 'nearest' })

    screen.draw()
    const stack = emulator.stack()
    stackBody.replaceChildren(table(stack.map((v, i) => [String(ADDR.STACK_BASE + i), String(v)])))
    framesBody.replaceChildren(table(emulator.frames().map((f) => [f.fn, String(f.lcl)])))
    globalsBody.replaceChildren(
      table([...emulator.globals()].map(([name, a]) => [name, `${emulator.memory.get(a)}`])),
    )
  }

  /**
   * The program as the linker lays it out: every fragment command first,
   * then each function's declaration followed by its body. The index of a
   * line is the step index, which is what the program counter holds.
   */
  function listingLines(files: readonly SmFile[], notation: Notation): string[] {
    const lines: string[] = []
    for (const file of files) {
      for (const c of file.fragment) lines.push(printCommand(c, notation))
    }
    for (const file of files) {
      for (const fn of file.functions) {
        lines.push(notation === 'words'
          ? `function ${fn.decl.name}(${fn.decl.args.join(',')})${fn.decl.locals.length ? ' locals ' + fn.decl.locals.join(',') : ''}`
          : `!${fn.decl.name}(${fn.decl.args.join(',')})${fn.decl.locals.join(',')}`)
        for (const c of fn.body) lines.push('  ' + printCommand(c, notation))
      }
    }
    return lines
  }

  function table(rows: ReadonlyArray<readonly [string, string]>): HTMLElement {
    const t = el('table', { class: 'cells', dir: 'ltr' })
    for (const [a, b] of rows) {
      t.append(el('tr', {}, el('td', { class: 'addr' }, a), el('td', {}, b)))
    }
    return t
  }

  const panel = (title: string, body: HTMLElement) =>
    el('div', { class: 'panel' }, el('h3', {}, title), body)

  root.append(
    el('h1', {}, s.nav.emulator),
    el('div', { class: 'controls' },
      stepBtn, runBtn, resetBtn, shareBtn, downloadBtn, openFiles, openFolder,
      el('label', {}, `${s.examples} `, examples),
      el('label', {}, `${s.notation} `, notationSelect),
      status),
    faultLine,
    noticeLine,
    el('div', { class: 'emulator' },
      el('div', {},
        panel(s.source, el('div', { class: 'body' }, source)),
        el('div', { style: 'height:0.75rem' }),
        panel(s.program, el('div', { class: 'body' }, listing))),
      el('div', {},
        panel(s.screen, el('div', { class: 'body' }, screen.element, el('p', { class: 'hint' }, s.keyboardHint))),
        el('div', { style: 'height:0.75rem' }),
        panel(s.stack, stackBody),
        el('div', { style: 'height:0.75rem' }),
        panel(s.frames, framesBody),
        el('div', { style: 'height:0.75rem' }),
        panel(s.globals, globalsBody))),
  )

  const shared = sharedProgram()
  if (shared !== undefined) source.value = shared

  try {
    const handed = shared !== undefined ? null : sessionStorage.getItem(HANDOFF)
    if (handed !== null && handed !== '') {
      sessionStorage.removeItem(HANDOFF)
      source.value = handed
    }
  } catch {
    // No storage, no hand-over; the page still works.
  }

  load()
  return root
}
