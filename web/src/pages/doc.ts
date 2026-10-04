/**
 * The Reference and Rationale pages: the normative documents, rendered.
 *
 * They are the files in spec/, not a copy of them, so the page cannot drift
 * from the specification. Markdown is imported as text at build time.
 */
import { marked } from 'marked'
import { el } from '../lib/dom.js'
import type { Strings } from '../lib/i18n.js'

export function docPage(title: string, markdown: string, banner?: string): HTMLElement {
  const article = el('article', { dir: 'ltr' })
  article.innerHTML = marked.parse(markdown, { async: false })
  const root = el('div')
  if (banner !== undefined) root.append(el('div', { class: 'banner' }, banner))
  root.append(article)
  return root
}

export function projectsPage(s: Strings): HTMLElement {
  const card = (href: string, title: string, body: string) =>
    el('a', { class: 'card', href }, el('h3', {}, title), el('p', {}, body))

  return el('div', {},
    el('h1', {}, s.nav.projects),
    el('p', {}, s.blurb.projects),
    el('div', { class: 'cards' },
      card('https://github.com/Rami5743/SM/tree/main/projects/07-sm',
        'projects/07-sm',
        s.p1),
      card('https://github.com/Rami5743/SM/tree/main/projects/08-sm',
        'projects/08-sm',
        s.p2),
      card('https://www.nand2tetris.org/project11',
        'project 11',
        s.p3)),
    el('h2', {}, s.courseTools),
    el('p', {}, s.courseToolsBlurb),
    el('ul', {},
      el('li', {}, el('a', { href: 'https://nand2tetris.github.io/web-ide/' }, 'nand2tetris web IDE')),
      el('li', {}, el('a', { href: 'https://www.nand2tetris.org/software' }, 'nand2tetris software'))),
  )
}
