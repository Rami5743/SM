/**
 * Running a .tst script against the SM emulator.
 *
 * File access goes through a host, so that the same runner drives the browser
 * and the command line. Nothing here reaches for the file system.
 */
import { parse, resolve, type SmFile } from '@sm/core'
import { Emulator, LIBRARY_CLASSES, standardLibrary, withLibrary } from '@sm/emulator'
import { addressOf, header, parseColumn, row, type ColumnSpec } from './format.js'
import { parseScript, type ScriptCommand } from './script.js'

export interface Host {
  /** The script's own name, for messages. */
  readonly scriptName: string
  /** Read a file named beside the script. */
  read(name: string): string
  /** Write one beside it. */
  write(name: string, text: string): void
  /** Every .sm file in the script's directory, for a bare `load`. */
  listSources(): readonly string[]
}

export interface RunResult {
  readonly output: string
  /** Absent unless the script had a compare-to. */
  readonly comparison?: { readonly ok: true } | { readonly ok: false; readonly line: number }
  readonly steps: number
}

export interface RunOptions {
  /**
   * Ignore `compare-to`. The generator needs this: a script names the .cmp it
   * will be checked against, and that file does not exist until the generator
   * has produced it.
   */
  readonly skipCompare?: boolean
}

export function runScript(source: string, host: Host, options: RunOptions = {}): RunResult {
  const commands = parseScript(source)
  const emulator = new Emulator()
  let columns: ColumnSpec[] = []
  let outputFile: string | undefined
  let compareFile: string | undefined
  const lines: string[] = []
  let loaded = false

  const load = (file: string | undefined): void => {
    const names = file === undefined ? host.listSources() : [file]
    const files: SmFile[] = names.map((name) => {
      const r = parse(name, host.read(name))
      if (r.diagnostics.length > 0) {
        throw new Error(r.diagnostics.map((d) => `${d.pos.file}: in line ${d.pos.line}: ${d.message}`).join('\n'))
      }
      return r.file
    })
    // A package's part-I tests are fragments, which the language permits only
    // as a teaching form; a script that loads one is asking for it.
    const anyFragment = files.some((f) => f.fragment.length > 0)
    const defined = new Set(files.flatMap((f) => f.functions.map((fn) => fn.decl.name)))

    // With no Sys.init there is nothing to bootstrap into, so the script is
    // planting a frame itself — the course's way of testing a function before
    // the student has written a bootstrap. Inferred rather than declared, so
    // that the script language stays the course's.
    //
    // A compiled Jack program is the other case with no Sys.init: there
    // Sys.init is the library's, and the bootstrap is what calls it. The two
    // are told apart by Main.main, which is what a Jack program has and an
    // SM exercise does not.
    const hasInit = defined.has('Sys.init')
    const isJackProgram = !hasInit && defined.has('Main.main')
    const entry = hasInit || isJackProgram || anyFragment ? 'bootstrap' : 'none'

    // The library fills what the program did not supply, as the course's VM
    // emulator does with its built-in OS: a name nothing defines, whose class
    // the library has. A hand-written SM exercise names nothing of the kind
    // and so is linked with nothing.
    const called = files.flatMap((f) => [
      ...f.fragment, ...f.functions.flatMap((fn) => fn.body),
    ]).flatMap((c) => (c.kind === 'call' ? [c.name] : []))
    const libraryClasses = new Set(LIBRARY_CLASSES)
    const needsLibrary = isJackProgram
      || called.some((n) => !defined.has(n) && libraryClasses.has(n.split('.')[0]!))

    const all = needsLibrary
      ? withLibrary(files, standardLibrary(), { seed: entry === 'bootstrap' ? ['Sys.init'] : [] })
      : files

    const problems = resolve({ files: all })
    if (problems.length > 0) {
      throw new Error(problems.map((d) => `${d.pos.file}: in line ${d.pos.line}: ${d.message}`).join('\n'))
    }
    emulator.load(all, { allowFragment: anyFragment, entry })
    loaded = true
  }

  const exec = (command: ScriptCommand): void => {
    switch (command.kind) {
      case 'load': load(command.file); return
      case 'output-file': outputFile = command.file; return
      case 'compare-to': compareFile = command.file; return
      case 'output-list':
        columns = command.columns.map(parseColumn)
        lines.push(header(columns))
        return
      case 'set':
        if (!loaded) throw new Error('`set` before anything was loaded')
        emulator.memory.set(addressOf(command.target), command.value)
        return
      case 'output':
        if (columns.length === 0) throw new Error('`output` with no output-list')
        lines.push(row(columns, (a) => emulator.memory.get(a)))
        return
      case 'smstep':
        if (!loaded) throw new Error('`smstep` before anything was loaded')
        emulator.step()
        return
      case 'repeat':
        for (let n = 0; n < command.times; n++) for (const c of command.body) exec(c)
        return
    }
  }

  for (const command of commands) exec(command)

  const output = lines.join('\n') + (lines.length > 0 ? '\n' : '')
  if (outputFile !== undefined) host.write(outputFile, output)

  let comparison: RunResult['comparison']
  if (compareFile !== undefined && options.skipCompare !== true) {
    comparison = compare(output, host.read(compareFile))
  }

  return { output, comparison, steps: emulator.steps }
}

/**
 * Line for line and character for character, which is what the course does:
 * one extra trailing space in the .cmp is a failure.
 */
export function compare(got: string, want: string): { ok: true } | { ok: false; line: number } {
  const a = got.replace(/\r/g, '').split('\n')
  const b = want.replace(/\r/g, '').split('\n')
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const left = a[i] ?? ''
    const right = b[i] ?? ''
    if (left !== right) return { ok: false, line: i + 1 }
  }
  return { ok: true }
}
