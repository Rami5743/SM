/**
 * The standard library, carried by the emulator.
 *
 * The course's VM emulator ships built-in implementations of the eight OS
 * classes and uses one wherever the program does not supply its own, so that
 * a student who has compiled a Jack program can run it with nothing to link.
 * This is the same arrangement in SM, with one difference: ours is not built
 * in at all. It is `os/jack`, compiled by our own compiler, checked in as
 * `os/sm`, and loaded as ordinary SM. A student can read it, step through it
 * and replace it a class at a time, which is what project 12 asks for.
 *
 * Only what the program reaches is linked. Pulling in all eight
 * unconditionally would define `Sys.init`, and `Sys.init` calls `Main.main`,
 * so a program without a `Main` would stop resolving.
 */
import { parse, type SmFile } from '@sm/core'
import { LIBRARY_SM } from './library.generated.js'

export const LIBRARY_CLASSES: readonly string[] = Object.keys(LIBRARY_SM)

let cache: readonly SmFile[] | undefined

/** The library, parsed once. */
export function standardLibrary(): readonly SmFile[] {
  if (cache === undefined) {
    cache = Object.entries(LIBRARY_SM).map(([name, source]) => {
      const { file, diagnostics } = parse(`${name}.sm`, source)
      if (diagnostics.length > 0) {
        throw new Error(`the standard library does not parse: ${diagnostics[0]!.message}`)
      }
      return file
    })
  }
  return cache
}

function classOf(name: string): string {
  const dot = name.indexOf('.')
  return dot < 0 ? name : name.slice(0, dot)
}

function callsIn(file: SmFile): string[] {
  const out: string[] = []
  const walk = (commands: readonly { kind: string; name?: string }[]) => {
    for (const c of commands) if (c.kind === 'call' && c.name !== undefined) out.push(c.name)
  }
  walk(file.fragment)
  for (const fn of file.functions) walk(fn.body)
  return out
}

export interface LibraryOptions {
  /** Names that count as called even though nothing in the files calls them. */
  readonly seed?: readonly string[]
}

/**
 * The user's files, followed by the library classes they reach. A class the
 * program defines itself is never taken from the library, whole class at a
 * time, which is how the course substitutes too.
 */
export function withLibrary(
  user: readonly SmFile[],
  library: readonly SmFile[] = standardLibrary(),
  options: LibraryOptions = {},
): SmFile[] {
  const available = new Map<string, SmFile>()
  for (const file of library) {
    const first = file.functions[0]
    if (first !== undefined) available.set(classOf(first.decl.name), file)
  }
  for (const file of user) {
    for (const fn of file.functions) available.delete(classOf(fn.decl.name))
  }

  const taken: SmFile[] = []
  const seen = new Set<string>()
  const pending = [...user.flatMap(callsIn), ...(options.seed ?? [])]

  while (pending.length > 0) {
    const cls = classOf(pending.pop()!)
    if (seen.has(cls)) continue
    seen.add(cls)
    const file = available.get(cls)
    if (file === undefined) continue
    taken.push(file)
    pending.push(...callsIn(file))
  }

  return [...user, ...taken]
}
