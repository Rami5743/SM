/**
 * The frame offsets of spec/sm.md section 3.4, kept here so that the
 * translator does not depend on the emulator.
 */
import type { FunctionDecl } from '@sm/core'

export function frameOffsetsOf(decl: FunctionDecl): Map<string, number> {
  const offsets = new Map<string, number>()
  decl.args.forEach((name, i) => offsets.set(name, i))
  const base = decl.args.length + 2
  decl.locals.forEach((name, j) => offsets.set(name, base + j))
  return offsets
}
