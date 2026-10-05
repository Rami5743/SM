/**
 * Opening files and folders.
 *
 * A program is usually several files — a `.vm` directory from the course, a
 * handful of `.sm` a compiler produced — so both pages that take a program
 * offer a file picker and a folder picker. The folder picker is
 * `webkitdirectory`, which every current browser implements under that name
 * however unpromising it looks.
 */
import { el } from './dom.js'

export interface Opened {
  readonly name: string
  readonly text: string
}

export interface OpenerOptions {
  /** The extension to keep, `.sm` or `.vm`; empty keeps everything, which
   *  is what a folder holding a test and its compare file needs. */
  readonly extension: string
  /** True for a folder picker, false for a file picker. */
  readonly folder: boolean
  readonly label: string
  readonly onOpen: (files: readonly Opened[]) => void
}

export function fileOpener(options: OpenerOptions): HTMLElement {
  const input = el('input', { type: 'file' })
  if (options.extension !== '') input.setAttribute('accept', options.extension)
  if (options.folder) {
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  } else {
    input.setAttribute('multiple', '')
  }

  input.addEventListener('change', () => {
    const chosen = Array.from(input.files ?? [])
      .filter((f) => f.name.endsWith(options.extension))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (chosen.length === 0) return
    void Promise.all(
      chosen.map(async (f): Promise<Opened> => ({ name: f.name, text: await f.text() })),
    ).then((files) => {
      options.onOpen(files)
      // So that choosing the same folder twice still fires.
      input.value = ''
    })
  })

  return el('label', { class: 'opener' }, options.label, input)
}
