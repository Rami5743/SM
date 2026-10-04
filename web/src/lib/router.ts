/**
 * Routing. Hebrew at `/`, English under `/en/`, the same tree in each.
 *
 * Switching language keeps the page, which is the point of having the two
 * trees match: a reader who is halfway down the reference does not want to be
 * sent back to the front door.
 */
import { PAGES, type Lang, type PageId } from './i18n.js'

export interface Route {
  readonly lang: Lang
  readonly page: PageId
}

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter((p) => p.length > 0)
  const lang: Lang = parts[0] === 'en' ? 'en' : 'he'
  const rest = parts[0] === 'en' ? parts.slice(1) : parts
  const first = rest[0]
  const page = PAGES.find((p) => p === first) ?? 'home'
  return { lang, page }
}

export function href(route: Route, base = ''): string {
  const langPart = route.lang === 'en' ? '/en' : ''
  const pagePart = route.page === 'home' ? '/' : `/${route.page}`
  return `${base}${langPart}${pagePart}`
}

/** The same page in the other language. */
export function switched(route: Route, lang: Lang): Route {
  return { lang, page: route.page }
}
