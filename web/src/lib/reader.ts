/**
 * The reference, as a reader sees it.
 *
 * `spec/sm.md` is two documents in one file. Most of it is the language,
 * which is what a student needs. Threaded through it are the marks
 * `(C1)`–`(C8)` and an opening note about which of this project's own
 * documents supersedes which — a record of where this reference departs
 * from the material it grew out of, and why. That record earns its keep in
 * the repository and answers no question a student has.
 *
 * So the page drops it and the file keeps it. One source of truth, and
 * nothing to go stale.
 */

/** `(C7)`, `(C3, C5)` — a parenthesis holding nothing but correction marks. */
const INLINE = /\s*\((C\d+)(,\s*C\d+)*\)/g

/** A two-column table row whose second column is only correction marks. */
const TABLE_CELL = /^(\|.*)\|\s*C\d+(,\s*C\d+)*\s*\|$/

/** A paragraph that is about the project's documents rather than about SM. */
function isInternalParagraph(paragraph: string): boolean {
  return /^The normative reference\./.test(paragraph)
    || /^Every point at which this reference departs/.test(paragraph)
    || /^התיעוד המחייב\./.test(paragraph)
    || /^כל נקודה שבה התיעוד הזה סוטה/.test(paragraph)
}

export function readerText(markdown: string): string {
  const kept = markdown
    .split('\n\n')
    .filter((paragraph) => !isInternalParagraph(paragraph))
    .join('\n\n')

  return kept
    .split('\n')
    .map((line) => line.replace(TABLE_CELL, '$1|').replace(INLINE, ''))
    .join('\n')
}
