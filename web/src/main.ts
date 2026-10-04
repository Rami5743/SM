/**
 * The site shell: a home page, the same tab bar everywhere, and two
 * languages with Hebrew the default.
 */
import smMarkdown from '../../spec/sm.md?raw'
import rationaleMarkdown from '../../spec/RATIONALE.md?raw'
import { el } from './lib/dom.js'
import { dirOf, LANGS, PAGES, STRINGS, type Lang, type PageId, type Strings } from './lib/i18n.js'
import { href, parseRoute, switched, type Route } from './lib/router.js'
import { emulatorPage } from './pages/emulator.js'
import { compilerPage } from './pages/compiler.js'
import { bridgePage } from './pages/bridge.js'
import { docPage, projectsPage } from './pages/doc.js'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

function homePage(s: Strings, route: Route): HTMLElement {
  const cards = PAGES.filter((p) => p !== 'home').map((p) =>
    el('a', { class: 'card', href: href({ ...route, page: p }, BASE) },
      el('h3', {}, s.nav[p]),
      el('p', {}, s.blurb[p])))
  return el('div', {},
    el('h1', {}, s.tagline),
    el('div', { class: 'cards' }, ...cards))
}

function pageFor(route: Route, s: Strings): HTMLElement {
  switch (route.page) {
    case 'home': return homePage(s, route)
    case 'emulator': return emulatorPage(s)
    case 'compiler': return compilerPage(s)
    case 'bridge': return bridgePage(s)
    // The documents are English only for now; the banner says so rather than
    // the page being missing.
    case 'reference': return docPage(s.nav.reference, smMarkdown, route.lang === 'he' ? s.untranslated : undefined)
    case 'rationale': return docPage(s.nav.rationale, rationaleMarkdown, route.lang === 'he' ? s.untranslated : undefined)
    case 'projects': return projectsPage(s)
  }
}

function chrome(route: Route, s: Strings): HTMLElement {
  const nav = el('nav')
  for (const p of PAGES) {
    const a = el('a', { href: href({ ...route, page: p }, BASE) }, s.nav[p])
    if (p === route.page) a.setAttribute('aria-current', 'page')
    nav.append(a)
  }
  const langs = el('div', { class: 'langs' })
  for (const { lang, flag, name } of LANGS) {
    const a = el('a', { href: href(switched(route, lang), BASE), lang }, `${flag} ${name}`)
    if (lang === route.lang) a.setAttribute('aria-current', 'true')
    langs.append(a)
  }
  return el('header', {},
    el('div', {},
      el('a', { class: 'brand', href: href({ ...route, page: 'home' }, BASE) }, s.siteName),
      ' ',
      el('span', { class: 'tagline' }, s.tagline)),
    nav,
    langs)
}

function render(): void {
  const route = parseRoute(location.pathname.slice(BASE.length) || '/')
  const s = STRINGS[route.lang]
  document.documentElement.lang = route.lang
  document.documentElement.dir = dirOf(route.lang)
  document.title = route.page === 'home' ? s.siteName : `${s.nav[route.page]} · ${s.siteName}`

  const app = document.querySelector('#app')
  if (app === null) return
  app.replaceChildren(chrome(route, s), el('main', {}, pageFor(route, s)))
}

// Links inside the site navigate without reloading.
document.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement | null)?.closest('a')
  if (target === null || target === undefined) return
  const url = new URL(target.href, location.href)
  if (url.origin !== location.origin) return
  event.preventDefault()
  history.pushState(null, '', url.pathname)
  render()
})
addEventListener('popstate', render)
render()
