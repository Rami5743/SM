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
import type { Strings } from '../lib/i18n.js'
import { download, zip } from '../lib/zip.js'
import { HANDOFF } from './compiler.js'

type Direction = 'sm-to-vm' | 'vm-to-sm'

const EXAMPLES: Readonly<Record<Direction, string>> = {
  'sm-to-vm': [
    '!Sys.init()',
    '<-3000',
    'Main.run',
    '->[]',
    'spin:',
    '-->spin',
    '',
    '!Main.run()i,sum',
    '<-0',
    '->@sum',
    '<-5',
    '->@i',
    'loop:',
    '<-@i',
    '<-1',
    '<',
    '?-->done',
    '<-@sum',
    '<-@i',
    '+',
    '->@sum',
    '<-@i',
    '<-1',
    '-',
    '->@i',
    '-->loop',
    'done:',
    '<-@sum',
    '<--',
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

  function convert(): void {
    try {
      if (direction === 'vm-to-sm') {
        const { sm } = vmToSm([parseVm('Main', source.value)])
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

  source.addEventListener('input', convert)

  const panel = (title: string, body: HTMLElement) =>
    el('div', { class: 'panel' }, el('h3', {}, title), body)

  const root = el('div', {},
    el('h1', {}, s.nav.bridge),
    el('p', {}, s.bridgeBlurb, ' ',
      el('a', { href: 'https://nand2tetris.github.io/web-ide/vm', target: '_blank', rel: 'noreferrer' },
        s.courseTools)),
    el('div', { class: 'controls' }, which, downloadBtn, sendBtn),
    faultLine,
    el('div', { class: 'emulator' },
      panel(s.source, el('div', { class: 'body' }, source)),
      panel(s.result, el('div', { class: 'body' }, output))),
  )

  convert()
  return root
}
