/**
 * The Reference and Rationale pages: the normative documents, rendered.
 *
 * They are the files in spec/, not a copy of them, so the page cannot drift
 * from the specification. Markdown is imported as text at build time.
 */
import { marked } from 'marked'
import { el } from '../lib/dom.js'
import { PACKAGES } from '../lib/packages.js'
import { download, zip } from '../lib/zip.js'
import type { Strings } from '../lib/i18n.js'

/**
 * A document, in the direction its own language runs. The code inside it is
 * marked left-to-right by the stylesheet whichever way the prose goes, which
 * is what lets a Hebrew paragraph hold `<-@x` without scrambling it.
 */
export function docPage(markdown: string, dir: 'ltr' | 'rtl'): HTMLElement {
  const article = el('article', { dir })
  article.innerHTML = marked.parse(markdown, { async: false })
  return el('div', {}, article)
}

export function projectsPage(s: Strings): HTMLElement {
  const card = (href: string, title: string, body: string) =>
    el('a', { class: 'card', href }, el('h3', {}, title), el('p', {}, body))

  const downloadBtn = el('button', {}, s.downloadProjects)
  downloadBtn.addEventListener('click', () => download('sm-projects.zip', zip(PACKAGES)))

  return el('div', {},
    el('h1', {}, s.nav.projects),
    el('p', {}, s.blurb.projects),
    el('div', { class: 'cards' },
      card('https://github.com/Rami5743/SM/tree/main/projects/07-sm',
        'projects/07-sm',
        s.p1),
      card('https://github.com/Rami5743/SM/tree/main/projects/08-sm',
        'projects/08-sm',
        s.p2)),
    el('p', {}, downloadBtn),
    el('h2', {}, s.courseTools),
    el('ul', {},
      el('li', {}, el('a', { href: 'https://nand2tetris.github.io/web-ide/' }, 'nand2tetris web IDE')),
      el('li', {}, el('a', { href: 'https://www.nand2tetris.org/software' }, 'nand2tetris software'))),
  )
}
