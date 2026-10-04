/**
 * The missing-return analysis, exactly as the course's compiler performs it.
 *
 * Recovered by running the official compiler on eleven purpose-built
 * subroutines, and written out in CORRECTIONS C6. It is a structural
 * recursion, not a reachability analysis in any semantic sense: the question
 * "is this line reached" is undecidable, so the check asks a weaker and
 * decidable one about the *shape* of the statement list.
 *
 * Two rows part company with the truth on purpose, and both are the course's.
 * An `if` without an `else` always completes, which is conservative. A
 * `while` completes only if its body does, which is optimistic — that is why
 * `while (true) { return 1; }` is accepted, and also why
 * `while (false) { return 1; }` is accepted though it plainly falls through.
 * The runtime check in the emulator is what catches the second.
 */
import type { Statement } from './ast.js'

/** Can control reach the point after this list? */
export function completes(statements: readonly Statement[]): boolean {
  for (const s of statements) {
    if (!completesStatement(s)) return false
  }
  return true
}

function completesStatement(s: Statement): boolean {
  switch (s.kind) {
    case 'let':
    case 'do':
      return true
    case 'return':
      return false
    case 'if':
      return s.else === undefined
        ? true // the condition may be false, so the end is reachable
        : completes(s.then) || completes(s.else)
    case 'while':
      return completes(s.body)
  }
}

/** The first statement that cannot be reached, if there is one. */
export function firstUnreachable(statements: readonly Statement[]): Statement | undefined {
  for (let i = 0; i < statements.length; i++) {
    if (!completesStatement(statements[i]!)) return statements[i + 1]
  }
  return undefined
}
