/** The Jack syntax tree. One parser, one tree, and a position on every node. */
export interface At { readonly line: number }

export type Type = 'int' | 'char' | 'boolean' | 'void' | string

export interface VarDec extends At {
  readonly type: Type
  readonly names: readonly string[]
}

export type SubroutineKind = 'constructor' | 'function' | 'method'

export interface Subroutine extends At {
  readonly kind: SubroutineKind
  readonly returns: Type
  readonly name: string
  readonly params: ReadonlyArray<{ readonly type: Type; readonly name: string }>
  readonly vars: readonly VarDec[]
  readonly body: readonly Statement[]
}

/** A `static` or `field` declaration, kept in source order so the tree can
 *  be printed back as the course's project 10 XML. */
export interface ClassVarDec extends VarDec {
  readonly scope: 'static' | 'field'
}

export interface ClassDec extends At {
  readonly name: string
  readonly classVars: readonly ClassVarDec[]
  readonly subroutines: readonly Subroutine[]
}

export function statics(cls: ClassDec): readonly ClassVarDec[] {
  return cls.classVars.filter((d) => d.scope === 'static')
}

export function fields(cls: ClassDec): readonly ClassVarDec[] {
  return cls.classVars.filter((d) => d.scope === 'field')
}

export type Statement =
  | { readonly kind: 'let'; readonly name: string; readonly index?: Expression; readonly value: Expression; readonly line: number }
  | { readonly kind: 'if'; readonly cond: Expression; readonly then: readonly Statement[]; readonly else?: readonly Statement[]; readonly line: number }
  | { readonly kind: 'while'; readonly cond: Expression; readonly body: readonly Statement[]; readonly line: number }
  | { readonly kind: 'do'; readonly call: Call; readonly line: number }
  | { readonly kind: 'return'; readonly value?: Expression; readonly line: number }

export interface Call extends At {
  /** `Foo.bar(...)` has a target; `bar(...)` is a method call on `this`. */
  readonly target?: string
  readonly name: string
  readonly args: readonly Expression[]
}

export type Expression =
  | { readonly kind: 'int'; readonly value: number; readonly line: number }
  | { readonly kind: 'string'; readonly value: string; readonly line: number }
  | { readonly kind: 'keyword'; readonly value: 'true' | 'false' | 'null' | 'this'; readonly line: number }
  | { readonly kind: 'var'; readonly name: string; readonly line: number }
  | { readonly kind: 'index'; readonly name: string; readonly index: Expression; readonly line: number }
  | { readonly kind: 'call'; readonly call: Call; readonly line: number }
  | { readonly kind: 'unary'; readonly op: '-' | '~'; readonly operand: Expression; readonly line: number }
  // `( e )` is kept rather than folded away: Jack has no precedence, so the
  // parentheses are the only thing that says `(a + b) * c` is not `a + b * c`,
  // and the project 10 XML prints them.
  | { readonly kind: 'paren'; readonly inner: Expression; readonly line: number }
  | { readonly kind: 'binary'; readonly op: string; readonly left: Expression; readonly right: Expression; readonly line: number }
