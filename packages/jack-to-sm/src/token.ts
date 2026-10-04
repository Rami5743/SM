/**
 * The Jack tokenizer.
 *
 * The grammar is the course's, unchanged — SM changes the target, not the
 * language — so there is nothing to design here. What this has that the
 * supplied one does not is a **position on every token**, which is why a
 * message from any later stage can name a line.
 */
export type TokenKind = 'keyword' | 'symbol' | 'integerConstant' | 'stringConstant' | 'identifier'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
  readonly line: number
}

export const KEYWORDS = new Set([
  'class', 'constructor', 'function', 'method', 'field', 'static', 'var',
  'int', 'char', 'boolean', 'void', 'true', 'false', 'null', 'this',
  'let', 'do', 'if', 'else', 'while', 'return',
])

const SYMBOLS = new Set('{}()[].,;+-*/&|<>=~'.split(''))

export class JackError extends Error {
  constructor(readonly file: string, readonly line: number, message: string) {
    super(`In ${file} (line ${line}): ${message}`)
    this.name = 'JackError'
  }
}

export function tokenize(file: string, source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1

  const atEnd = () => i >= source.length

  while (!atEnd()) {
    const c = source[i]!

    if (c === '\n') { line++; i++; continue }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }

    if (c === '/' && source[i + 1] === '/') {
      while (!atEnd() && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const start = line
      i += 2
      while (!atEnd() && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++
        i++
      }
      if (atEnd()) throw new JackError(file, start, 'a /* comment is never closed')
      i += 2
      continue
    }

    if (c === '"') {
      const start = line
      i++
      let text = ''
      while (!atEnd() && source[i] !== '"') {
        if (source[i] === '\n') throw new JackError(file, start, 'a string runs past the end of its line')
        text += source[i]
        i++
      }
      if (atEnd()) throw new JackError(file, start, 'a string is never closed')
      i++
      tokens.push({ kind: 'stringConstant', text, line: start })
      continue
    }

    if (SYMBOLS.has(c)) {
      tokens.push({ kind: 'symbol', text: c, line })
      i++
      continue
    }

    if (c >= '0' && c <= '9') {
      let text = ''
      while (!atEnd() && source[i]! >= '0' && source[i]! <= '9') { text += source[i]; i++ }
      const value = Number(text)
      if (value > 32767) throw new JackError(file, line, `${text} is above the largest integer constant, 32767`)
      tokens.push({ kind: 'integerConstant', text, line })
      continue
    }

    if (/[A-Za-z_]/.test(c)) {
      let text = ''
      while (!atEnd() && /[A-Za-z0-9_]/.test(source[i]!)) { text += source[i]; i++ }
      tokens.push({ kind: KEYWORDS.has(text) ? 'keyword' : 'identifier', text, line })
      continue
    }

    throw new JackError(file, line, `${JSON.stringify(c)} is not part of the language`)
  }

  return tokens
}

/** The project 10 XML, which the course's own compare files check. */
export function tokensToXml(tokens: readonly Token[]): string {
  const out = ['<tokens>']
  for (const t of tokens) out.push(`<${t.kind}> ${escapeXml(t.text)} </${t.kind}>`)
  out.push('</tokens>', '')
  return out.join('\n')
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
