/**
 * The bridge page: the same program on both machines, side by side.
 *
 * This is the page that makes the point of the whole project checkable by
 * eye. Paste a course `.vm` file and read it as SM; write SM and read it as
 * `.vm`, download the files, and run them in the course's own VM emulator,
 * which is linked rather than hosted. The differences the translation has
 * to close are listed at the end of the reference page.
 */
import { parse, resolve } from '@sm/core'
import { BridgeError, parseVm, smToVm, VmError, vmToSm } from '@sm/vm'
import { el } from '../lib/dom.js'
import { fileOpener, type Opened } from '../lib/open-files.js'
import type { Strings } from '../lib/i18n.js'
import { download, zip } from '../lib/zip.js'
import { HANDOFF } from './compiler.js'

type Direction = 'sm-to-vm' | 'vm-to-sm'

const EXAMPLES: Readonly<Record<Direction, string>> = {
  'sm-to-vm': [
    'function Sys.init()',
    'push 3000',
    'call Main.run',
    'pop-indirect',
    'label spin',
    'goto spin',
    '',
    'function Main.run() locals i, sum',
    'push 0',
    'pop @sum',
    'push 5',
    'pop @i',
    'label loop',
    'push @i',
    'push 1',
    'lt',
    'if-goto done',
    'push @sum',
    'push @i',
    'add',
    'pop @sum',
    'push @i',
    'push 1',
    'sub',
    'pop @i',
    'goto loop',
    'label done',
    'push @sum',
    'return',
    '',
  ].join('\n'),
  'vm-to-sm': [
    '// A course .vm file, as it comes.',
    'push constant 17',
    'push constant 17',
    'eq',
    'push constant 892',
    'push constant 891',
    'lt',
    'and',
    'push pointer 0',
    'pop this 0',
    '',
  ].join('\n'),
}

export function bridgePage(s: Strings): HTMLElement {
  let direction: Direction = 'vm-to-sm'
  const source = el('textarea', { spellcheck: 'false', dir: 'ltr' })
  source.value = EXAMPLES[direction]
  const output = el('pre', { class: 'code', dir: 'ltr' })
  const faultLine = el('div', { class: 'fault' })
  const downloadBtn = el('button', {}, s.download)
  const sendBtn = el('button', {}, s.sendToEmulator)
  let produced: Record<string, string> = {}
  /** Extra `.vm` files the reader opened, beside the one in the box. */
  let imported: Record<string, string> = {}

  const which = el('select')
  which.append(
    el('option', { value: 'vm-to-sm' }, s.vmToSm),
    el('option', { value: 'sm-to-vm' }, s.smToVm),
  )
  which.addEventListener('change', () => {
    direction = which.value as Direction
    source.value = EXAMPLES[direction]
    convert()
  })

  // A `static i` belongs to its file, so a program of several `.vm` files
  // has to be translated as several, not as one concatenation. A course
  // program is a directory, so a directory is what the page takes.
  const opened = (files: readonly Opened[]): void => {
    which.value = 'vm-to-sm'
    direction = 'vm-to-sm'
    imported = Object.fromEntries(files.map((f) => [f.name.replace(/\.vm$/, ''), f.text]))
    source.value = files.map((f) => `// ${f.name}\n${f.text.replace(/\n*$/, '\n')}`).join('\n')
    convert()
  }
  const openFiles = fileOpener({ extension: '.vm', folder: false, label: s.openFiles, onOpen: opened })
  const openFolder = fileOpener({ extension: '.vm', folder: true, label: s.openFolder, onOpen: opened })

  function convert(): void {
    try {
      if (direction === 'vm-to-sm') {
        const parts = Object.keys(imported).length > 0
          ? Object.entries(imported).map(([name, text]) => parseVm(name, text))
          : [parseVm('Main', source.value)]
        const { sm } = vmToSm(parts)
        produced = { 'Main.sm': sm }
        output.textContent = sm
      } else {
        const parsed = parse('program.sm', source.value)
        const problems = [...parsed.diagnostics, ...resolve({ files: [parsed.file] })]
        if (problems.length > 0) {
          throw new BridgeError(
            problems.map((d) => `program.sm: in line ${d.pos.line}: ${d.message}`).join('\n'),
          )
        }
        produced = {}
        for (const [name, text] of Object.entries(smToVm([parsed.file]).files)) {
          produced[`${name}.vm`] = text
        }
        output.textContent = Object.entries(produced)
          .map(([name, text]) => `// ${name}\n${text}`).join('\n')
      }
      faultLine.textContent = ''
      downloadBtn.disabled = false
      sendBtn.disabled = direction !== 'vm-to-sm'
    } catch (error) {
      faultLine.textContent = error instanceof BridgeError || error instanceof VmError
        ? error.message
        : String(error)
      output.textContent = ''
      produced = {}
      downloadBtn.disabled = true
      sendBtn.disabled = true
    }
  }

  downloadBtn.addEventListener('click', () => {
    const names = Object.keys(produced)
    if (names.length === 0) return
    if (names.length === 1) {
      download(names[0]!, produced[names[0]!]!)
      return
    }
    download('program.zip', zip(produced))
  })

  sendBtn.addEventListener('click', () => {
    try {
      sessionStorage.setItem(HANDOFF, produced['Main.sm'] ?? '')
    } catch {
      // No storage, no hand-over.
    }
    location.assign(location.pathname.replace(/bridge\/?$/, 'emulator'))
  })

  // Typing replaces whatever was opened; the box is the source of truth.
  source.addEventListener('input', () => { imported = {}; convert() })

  const panel = (title: string, body: HTMLElement) =>
    el('div', { class: 'panel' }, el('h3', {}, title), body)

  const root = el('div', {},
    el('h1', {}, s.nav.bridge),
    el('p', {}, s.bridgeIntro),
    el('p', {}, `${s.bridgeRun} `,
      el('a', { href: 'https://nand2tetris.github.io/web-ide/vm', target: '_blank', rel: 'noreferrer' },
        s.courseToolsLink)),
    el('div', { class: 'controls' }, which, downloadBtn, sendBtn, openFiles, openFolder),
    faultLine,
    el('div', { class: 'emulator' },
      panel(s.source, el('div', { class: 'body' }, source)),
      panel(s.result, el('div', { class: 'body' }, output))),
  )

  convert()
  return root
}
