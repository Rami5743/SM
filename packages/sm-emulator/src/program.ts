/**
 * Laying a set of parsed files out as one sequence of steps.
 *
 * The step index is the program counter, and a return address is such an
 * index. Each step remembers which function it belongs to, which is what lets
 * the emulator notice control falling off the end of one: advancing from the
 * last step of a function into the next function's entry is the fault
 * CORRECTIONS C6 names, while *jumping* to that entry is an ordinary call.
 */
import type { Command, FunctionDecl, SmFile } from '@sm/core'

export type Step =
  | { readonly kind: 'enter'; readonly fn: number; readonly decl: FunctionDecl }
  | { readonly kind: 'command'; readonly fn: number; readonly command: Command }

/** The function index a fragment's steps carry: they belong to none. */
export const NO_FUNCTION = -1

export interface LoadedFunction {
  readonly decl: FunctionDecl
  /** The step index a call jumps to. */
  readonly entry: number
  /** Where each local sits, as an offset from LCL. */
  readonly offsets: ReadonlyMap<string, number>
}

export interface Program {
  readonly steps: readonly Step[]
  readonly functions: readonly LoadedFunction[]
  readonly byName: ReadonlyMap<string, number>
  /** Label name to step index, per function. */
  readonly labels: readonly ReadonlyMap<string, number>[]
  /**
   * The same for a fragment's own labels. A fragment is a bare run of
   * commands and the teaching form of spec/sm.md section 8.1 has no jumps
   * in it, but a `.vm` file of the course's project 7 is exactly such a run
   * and the VM→SM bridge gives one branches, so the labels are kept.
   */
  readonly fragmentLabels: ReadonlyMap<string, number>
  /**
   * How many steps at the start of `steps` are fragment commands — those that
   * preceded any declaration. The language permits them only in the teaching
   * form of spec/sm.md section 8.1, so a loader decides whether to allow
   * them; they carry `NO_FUNCTION` and run with the stack as their only
   * state.
   */
  readonly fragmentEnd: number
}

/**
 * Offsets within the frame, from spec/sm.md section 3.4: argument i at LCL+i,
 * the saved LCL at LCL+a, the return address at LCL+a+1, internal variable j
 * at LCL+a+2+j.
 */
export function frameOffsets(decl: FunctionDecl): Map<string, number> {
  const offsets = new Map<string, number>()
  decl.args.forEach((name, i) => offsets.set(name, i))
  const base = decl.args.length + 2
  decl.locals.forEach((name, j) => offsets.set(name, base + j))
  return offsets
}

export function link(files: readonly SmFile[]): Program {
  const steps: Step[] = []
  const functions: LoadedFunction[] = []
  const byName = new Map<string, number>()
  const labels: Map<string, number>[] = []
  const fragmentLabels = new Map<string, number>()
  for (const file of files) {
    for (const command of file.fragment) {
      if (command.kind === 'label') fragmentLabels.set(command.name, steps.length)
      steps.push({ kind: 'command', fn: NO_FUNCTION, command })
    }
  }
  const fragmentEnd = steps.length

  for (const file of files) {
    for (const fn of file.functions) {
      const index = functions.length
      const entry = steps.length
      steps.push({ kind: 'enter', fn: index, decl: fn.decl })

      const ownLabels = new Map<string, number>()
      for (const command of fn.body) {
        if (command.kind === 'label') ownLabels.set(command.name, steps.length)
        steps.push({ kind: 'command', fn: index, command })
      }

      functions.push({ decl: fn.decl, entry, offsets: frameOffsets(fn.decl) })
      byName.set(fn.decl.name, index)
      labels.push(ownLabels)
    }
  }

  return { steps, functions, byName, labels, fragmentLabels, fragmentEnd }
}
