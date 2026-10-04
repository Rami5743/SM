/**
 * Name resolution: the checks of CORRECTIONS C3 and C7.
 *
 * Three of them are the course's own, measured on its VM emulator and adopted
 * with its wording. Two go beyond it: a label declared twice in one function,
 * which the author's documentation forbids and the course does not check, and
 * a reference to a local the function does not declare, which SM can catch
 * here because its locals are named where the course's are numbered — there
 * `push local 5` can only fault at run time.
 *
 * All of this is ours. A student's translator is never required to perform
 * any of it.
 */
import type { Command, SmFile } from './ast.js'
import { type Diagnostic, error } from './diagnostic.js'

export interface Program {
  readonly files: readonly SmFile[]
}

export function resolve(program: Program): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  // Function names are global to the program and must be distinct (C7).
  const declared = new Map<string, string>()
  for (const file of program.files) {
    for (const fn of file.functions) {
      const earlier = declared.get(fn.decl.name)
      if (earlier !== undefined) {
        diagnostics.push(
          error(fn.decl.pos, `function ${fn.decl.name} already exists, declared in ${earlier}`),
        )
      } else {
        declared.set(fn.decl.name, file.file)
      }
    }
  }

  for (const file of program.files) {
    for (const fn of file.functions) {
      const locals = new Set<string>()
      for (const name of [...fn.decl.args, ...fn.decl.locals]) {
        if (locals.has(name)) {
          diagnostics.push(
            error(fn.decl.pos, `${fn.decl.name} declares ${name} twice`),
          )
        }
        locals.add(name)
      }

      const labels = labelsOf(fn.body, fn.decl.name, diagnostics)
      for (const cmd of fn.body) {
        switch (cmd.kind) {
          case 'goto':
          case 'ifGoto':
            if (!labels.has(cmd.name)) {
              diagnostics.push(
                error(cmd.pos, `unknown label - ${fn.decl.name}$${cmd.name}`),
              )
            }
            break
          case 'pushLocal':
          case 'popLocal':
            if (!locals.has(cmd.name)) {
              diagnostics.push(
                error(cmd.pos, `${fn.decl.name} has no local named ${cmd.name}`),
              )
            }
            break
          default:
            checkCall(cmd, declared, diagnostics)
        }
      }
    }
  }

  // A fragment's own labels and calls. The teaching form of spec/sm.md
  // section 8.1 has no jumps, but the VM→SM bridge gives a project 7 `.vm`
  // file branches, and a jump to nowhere should be caught here rather than
  // at run time.
  for (const file of program.files) {
    if (file.fragment.length === 0) continue
    const labels = labelsOf(file.fragment, '<fragment>', diagnostics)
    for (const cmd of file.fragment) {
      switch (cmd.kind) {
        case 'goto':
        case 'ifGoto':
          if (!labels.has(cmd.name)) {
            diagnostics.push(error(cmd.pos, `unknown label - <fragment>$${cmd.name}`))
          }
          break
        case 'pushLocal':
        case 'popLocal':
          diagnostics.push(error(cmd.pos, `${cmd.name} is a local, and a fragment has no frame`))
          break
        default:
          checkCall(cmd, declared, diagnostics)
      }
    }
  }

  return diagnostics
}

/** The labels a run of commands declares, reporting any declared twice. */
function labelsOf(
  commands: readonly Command[],
  owner: string,
  diagnostics: Diagnostic[],
): Set<string> {
  const labels = new Set<string>()
  for (const cmd of commands) {
    if (cmd.kind !== 'label') continue
    if (labels.has(cmd.name)) {
      diagnostics.push(error(cmd.pos, `label ${cmd.name} already exists in function ${owner}`))
    }
    labels.add(cmd.name)
  }
  return labels
}

function checkCall(
  cmd: Command,
  declared: ReadonlyMap<string, string>,
  diagnostics: Diagnostic[],
): void {
  if (cmd.kind === 'call' && !declared.has(cmd.name)) {
    diagnostics.push(error(cmd.pos, `function ${cmd.name} not found`))
  }
}
