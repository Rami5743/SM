/**
 * Diagnostics.
 *
 * Every check we perform is our tools' business and never the student's:
 * their translator may assume its input is well formed, exactly as the
 * course's may. See PLAN section 2.
 */
import type { Pos } from './ast.js'

export type Severity = 'error' | 'warning'

export interface Diagnostic {
  readonly severity: Severity
  readonly message: string
  readonly pos: Pos
}

export function error(pos: Pos, message: string): Diagnostic {
  return { severity: 'error', message, pos }
}

export function warning(pos: Pos, message: string): Diagnostic {
  return { severity: 'warning', message, pos }
}

/** The course's shape: `Foo.sm: in line 4: what went wrong`. */
export function format(d: Diagnostic): string {
  return `${d.pos.file}: in line ${d.pos.line}: ${d.message}`
}
