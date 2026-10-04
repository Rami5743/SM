/**
 * Two languages, Hebrew the default.
 *
 * Hebrew is served at `/`, English at `/en/`, the same tree under each. The
 * switch keeps the reader on the page they are on.
 *
 * What is *not* translated: the mnemonics, the code, the file names, the
 * `.tst` syntax, and the diagnostics. The messages are the course's own
 * wording, adopted by C6 and C7, and translating them would break the match
 * that is their point.
 */
export type Lang = 'he' | 'en'

export const LANGS: ReadonlyArray<{ lang: Lang; flag: string; name: string }> = [
  { lang: 'he', flag: '🇮🇱', name: 'עברית' },
  { lang: 'en', flag: '🇬🇧', name: 'English' },
]

export function dirOf(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr'
}

export interface Strings {
  readonly siteName: string
  readonly tagline: string
  readonly nav: Readonly<Record<PageId, string>>
  readonly blurb: Readonly<Record<PageId, string>>
  readonly run: string
  readonly step: string
  readonly reset: string
  readonly stack: string
  readonly frames: string
  readonly globals: string
  readonly ram: string
  readonly source: string
  readonly program: string
  readonly notation: string
  readonly mnemonics: string
  readonly words: string
  readonly halted: string
  readonly steps: string
  readonly examples: string
  readonly courseTools: string
  readonly courseToolsBlurb: string
  readonly untranslated: string
  readonly p1: string
  readonly p2: string
  readonly p3: string
}

export type PageId = 'home' | 'emulator' | 'reference' | 'rationale' | 'projects'

export const PAGES: readonly PageId[] = ['home', 'emulator', 'reference', 'rationale', 'projects']

const he: Strings = {
  siteName: 'SM',
  tagline: 'מכונת מחסנית, חלופה למכונה הווירטואלית של נאנד לטטריס',
  nav: {
    home: 'ראשי',
    emulator: 'אמולטור',
    reference: 'תיעוד',
    rationale: 'רציונל',
    projects: 'תרגילים',
  },
  blurb: {
    home: 'כל העמודים במקום אחד.',
    emulator: 'הרצת קוד, צעד אחר צעד, עם המחסנית והמסגרות והזיכרון.',
    reference: 'התיעוד המחייב של השפה: הפקודות, מודל הזיכרון, המסגרת, השגיאות.',
    rationale: 'למה המכונה הזאת שונה מזו של הקורס, ומה זה עולה.',
    projects: 'שתי חבילות התרגילים, והמשימה השנייה.',
  },
  run: 'הרץ',
  step: 'צעד',
  reset: 'אתחל',
  stack: 'מחסנית',
  frames: 'מסגרות',
  globals: 'גלובליים',
  ram: 'זיכרון',
  source: 'קוד מקור',
  program: 'התוכנית כפי שנקראה',
  notation: 'סימון',
  mnemonics: 'מנמוניקות',
  words: 'מילים',
  halted: 'נעצר',
  steps: 'צעדים',
  examples: 'דוגמאות',
  courseTools: 'הכלים של הקורס',
  courseToolsBlurb: 'אנחנו לא מארחים אותם, רק מקשרים.',
  untranslated: 'העמוד הזה עדיין לא תורגם, ומוצג באנגלית.',
  p1: 'החלק הראשון של המתרגם: הפקודות שאינן דורשות מסגרת.',
  p2: 'החלק השני: בקרת זרימה, פונקציות, ולבסוף האתחול.',
  p3: 'המשימה השנייה היא יחידה 11 של הקורס עצמו, בלי שינוי. מקמפלים עם הקומפיילר שכתבתם, ומריצים כאן.',
}

const en: Strings = {
  siteName: 'SM',
  tagline: 'A stack machine, as an alternative to the nand2tetris VM',
  nav: {
    home: 'Home',
    emulator: 'Emulator',
    reference: 'Reference',
    rationale: 'Rationale',
    projects: 'Projects',
  },
  blurb: {
    home: 'Every page in one place.',
    emulator: 'Run a program, a step at a time, with the stack, the frames and the memory.',
    reference: 'The normative reference: the commands, the memory model, the frame, the errors.',
    rationale: 'Why this machine differs from the course’s, and what that costs.',
    projects: 'The two packages of exercises, and the second assignment.',
  },
  run: 'Run',
  step: 'Step',
  reset: 'Reset',
  stack: 'Stack',
  frames: 'Frames',
  globals: 'Globals',
  ram: 'RAM',
  source: 'Source',
  program: 'The program as read',
  notation: 'Notation',
  mnemonics: 'Mnemonics',
  words: 'Words',
  halted: 'halted',
  steps: 'steps',
  examples: 'Examples',
  courseTools: 'The course’s own tools',
  courseToolsBlurb: 'Linked, not hosted.',
  untranslated: 'This page is not translated yet, and is shown in English.',
  p1: 'The first half of the translator: the commands that need no frame.',
  p2: 'The second: control flow, functions, and finally the bootstrap.',
  p3: 'The second assignment is the course\u2019s own project 11, unchanged. Compile it with the compiler you wrote, and run the result here.',
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { he, en }
