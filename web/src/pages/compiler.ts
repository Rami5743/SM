/**
 * The compiler page: Jack in, SM out.
 *
 * It exists for two reasons. A student writing their own Jack → SM compiler
 * needs something to compare against, and the output here is what the
 * library itself is built from. And the two checks the course's compiler
 * performs and the prototype did not — an unqualified call inside a
 * `function`, and control reaching the end of a subroutine without a
 * `return` — are visible here rather than buried in a build log.
 */
import { compileClass, JackError, parseClass } from '@sm/jack'
import { el } from '../lib/dom.js'
import { download } from '../lib/zip.js'
import type { Strings } from '../lib/i18n.js'

/** Where a compiled program waits while the reader walks to the emulator. */
export const HANDOFF = 'sm.compiled'

const EXAMPLES: ReadonlyArray<{ name: string; source: string }> = [
  {
    name: 'Main',
    source: [
      'class Main {',
      '    function void main() {',
      '        var int i, sum;',
      '        let i = 1;',
      '        let sum = 0;',
      '        while (~(i > 10)) {',
      '            let sum = sum + (i * i);',
      '            let i = i + 1;',
      '        }',
      '        do Output.printString("sum of squares: ");',
      '        do Output.printInt(sum);',
      '        return;',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'Point',
    source: [
      '// A field is reached with [] over an address on the stack, so there is',
      '// no pointer segment and no this/that to re-point.',
      'class Point {',
      '    field int x, y;',
      '',
      '    constructor Point new(int ax, int ay) {',
      '        let x = ax;',
      '        let y = ay;',
      '        return this;',
      '    }',
      '',
      '    method int sum() {',
      '        return x + y;',
      '    }',
      '',
      '    method void dispose() {',
      '        do Memory.deAlloc(this);',
      '        return;',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'Missing return',
    source: [
      '// The course rejects this rather than inserting a return, and so do we.',
      'class Main {',
      '    function int f(int n) {',
      '        if (n > 0) {',
      '            return 1;',
      '        }',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
]

export function compilerPage(s: Strings): HTMLElement {
  const source = el('textarea', { spellcheck: 'false', dir: 'ltr' })
  source.value = EXAMPLES[0]!.source

  const output = el('pre', { class: 'code', dir: 'ltr' })
  const faultLine = el('div', { class: 'fault' })
  const warningLine = el('div', { class: 'warning' })
  const sendBtn = el('button', {}, s.sendToEmulator)
  const downloadBtn = el('button', {}, s.download)
  downloadBtn.addEventListener('click', () => {
    download(`${nameOf(source.value)}.sm`, output.textContent ?? '')
  })

  const examples = el('select')
  for (const [i, ex] of EXAMPLES.entries()) examples.append(el('option', { value: String(i) }, ex.name))
  examples.addEventListener('change', () => {
    source.value = EXAMPLES[Number(examples.value)]!.source
    compile()
  })

  function nameOf(jack: string): string {
    return /class\s+([A-Za-z_]\w*)/.exec(jack)?.[1] ?? 'Main'
  }

  function compile(): void {
    const file = `${nameOf(source.value)}.jack`
    try {
      const result = compileClass(file, parseClass(file, source.value))
      faultLine.textContent = ''
      warningLine.textContent = result.warnings.length > 0 ? result.warnings.join('\n') : ''
      output.textContent = result.sm
      sendBtn.disabled = false
      downloadBtn.disabled = false
    } catch (error) {
      faultLine.textContent = error instanceof JackError ? error.message : String(error)
      warningLine.textContent = ''
      output.textContent = ''
      sendBtn.disabled = true
      downloadBtn.disabled = true
    }
  }

  sendBtn.addEventListener('click', () => {
    try {
      sessionStorage.setItem(HANDOFF, output.textContent ?? '')
    } catch {
      // A browser that refuses storage simply does not get the shortcut.
    }
    location.assign(location.pathname.replace(/compiler\/?$/, 'emulator'))
  })

  source.addEventListener('input', compile)

  const panel = (title: string, body: HTMLElement) =>
    el('div', { class: 'panel' }, el('h3', {}, title), body)

  const root = el('div', {},
    el('h1', {}, s.nav.compiler),
    el('div', { class: 'controls' },
      sendBtn, downloadBtn,
      el('label', {}, `${s.examples} `, examples)),
    faultLine,
    warningLine,
    el('div', { class: 'emulator' },
      panel(s.jack, el('div', { class: 'body' }, source)),
      panel(s.compiled, el('div', { class: 'body' }, output))),
  )

  compile()
  return root
}
