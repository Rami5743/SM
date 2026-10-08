/**
 * The SM syntax tree.
 *
 * One node per command of spec/sm.md section 6, plus the declaration that
 * opens a function. Every node carries the line it came from, because a
 * diagnostic that cannot name a line is of little use (see INVENTORY section
 * 4a: the supplied Jack front end has no positions, and so no message from any
 * later stage can point anywhere).
 */

/** A position in a source file. Lines and columns count from 1. */
export interface Pos {
  readonly file: string
  readonly line: number
}

/** Arithmetic, logic and memory: the commands that take no operand. */
export type SimpleOp =
  | 'add' | 'sub' | 'neg' | 'not' | 'and' | 'or'
  | 'eq' | 'gt' | 'lt'
  | 'push-indirect' | 'pop-indirect'

export const SIMPLE_OPS: readonly SimpleOp[] = [
  'add', 'sub', 'neg', 'not', 'and', 'or', 'eq', 'gt', 'lt',
  'push-indirect', 'pop-indirect',
]

export type Command =
  | { readonly kind: 'pushConst'; readonly value: number; readonly pos: Pos }
  | { readonly kind: 'pushGlobal'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'pushLocal'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'popGlobal'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'popLocal'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'op'; readonly op: SimpleOp; readonly pos: Pos }
  | { readonly kind: 'label'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'goto'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'ifGoto'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'call'; readonly name: string; readonly pos: Pos }
  | { readonly kind: 'return'; readonly pos: Pos }

export interface FunctionDecl {
  readonly name: string
  readonly args: readonly string[]
  readonly locals: readonly string[]
  readonly pos: Pos
}

/**
 * A function: its declaration and the commands up to the next declaration.
 */
export interface SmFunction {
  readonly decl: FunctionDecl
  readonly body: readonly Command[]
}

/**
 * One parsed file.
 *
 * `fragment` holds commands that appear before any declaration. The language
 * does not permit them (spec/sm.md section 8.1) except in the teaching form
 * used by the first package of exercises, so the parser records them and
 * leaves the judgement to whoever asked for the parse.
 */
export interface SmFile {
  readonly file: string
  readonly fragment: readonly Command[]
  readonly functions: readonly SmFunction[]
}
