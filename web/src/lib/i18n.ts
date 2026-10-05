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
  readonly p1: string
  readonly p2: string
  readonly screen: string
  readonly keyboard: string
  readonly keyboardHint: string
  readonly jack: string
  readonly compiled: string
  readonly compile: string
  readonly sendToEmulator: string
  readonly library: string
  readonly libraryOn: string
  readonly noWarnings: string
  readonly download: string
  readonly copyLink: string
  readonly copied: string
  readonly result: string
  readonly smToVm: string
  readonly vmToSm: string
  readonly bridgeBlurb: string
  readonly openFiles: string
  readonly openFolder: string
  readonly downloadProjects: string
  readonly script: string
  readonly runTest: string
  readonly output: string
  readonly comparePassed: string
  readonly compareFailed: string
  readonly noScript: string
}

export type PageId =
  | 'home' | 'emulator' | 'compiler' | 'bridge' | 'reference' | 'rationale' | 'projects'

export const PAGES: readonly PageId[] =
  ['home', 'emulator', 'compiler', 'bridge', 'reference', 'rationale', 'projects']

const he: Strings = {
  siteName: 'SM',
  tagline: 'מכונת מחסנית, חלופה למכונה הווירטואלית של נאנד לטטריס',
  nav: {
    home: 'ראשי',
    emulator: 'אמולטור',
    compiler: 'קומפיילר',
    bridge: 'גשר',
    reference: 'תיעוד',
    rationale: 'רציונל',
    projects: 'משימות',
  },
  blurb: {
    home: 'כל העמודים במקום אחד.',
    emulator: 'הרצת קוד, צעד אחר צעד, עם המחסנית והמסגרות והזיכרון.',
    compiler: 'מ‑Jack ל‑SM, עם הבדיקות של הקורס.',
    bridge: 'אותה תוכנית בשתי המכונות, לשני הכיוונים.',
    reference: 'התיעוד המחייב של השפה: הפקודות, מודל הזיכרון, המסגרת, השגיאות.',
    rationale: 'למה המכונה הזאת שונה מזו של הקורס, ומה זה עולה.',
    projects: 'שתי חבילות התרגילים.',
  },
  run: 'הרץ',
  step: 'צעד',
  reset: 'אתחל',
  stack: 'מחסנית',
  frames: 'מסגרות',
  globals: 'גלובליים',
  ram: 'זיכרון',
  source: 'קוד מקור',
  program: 'הקוד לאחר ניקוי',
  notation: 'סימון',
  mnemonics: 'מנמוניקות',
  words: 'מילים',
  halted: 'נעצר',
  steps: 'צעדים',
  examples: 'דוגמאות',
  courseTools: 'קישורים לכלים של הקורס',
  p1: 'החלק הראשון של המתרגם: הפקודות שאינן דורשות מסגרת.',
  p2: 'החלק השני: בקרת זרימה, פונקציות, ולבסוף האתחול.',
  screen: 'מסך',
  keyboard: 'מקלדת',
  keyboardHint: 'לחצו כאן ואז הקישו; המקש נכתב ל‑24576.',
  jack: 'קוד Jack',
  compiled: 'הפלט ב‑SM',
  compile: 'קמפל',
  sendToEmulator: 'שלח לאמולטור',
  library: 'ספרייה',
  libraryOn: 'קושרה',
  noWarnings: 'אין אזהרות.',
  download: 'הורד',
  copyLink: 'העתק קישור',
  copied: 'הקישור הועתק.',
  result: 'התוצאה',
  smToVm: 'מ‑SM ל‑VM',
  vmToSm: 'מ‑VM ל‑SM',
  bridgeBlurb: 'את הפלט אפשר להריץ באמולטור של הקורס:',
  openFiles: 'טען קובץ',
  openFolder: 'טען תיקייה',
  downloadProjects: 'הורד את שתי התיקיות',
  script: 'סקריפט הבדיקה',
  runTest: 'הרץ את הבדיקה',
  output: 'הפלט',
  comparePassed: 'ההשוואה עברה.',
  compareFailed: 'ההשוואה נכשלה בשורה',
  noScript: 'לדוגמה הזאת אין סקריפט בדיקה.',
}

const en: Strings = {
  siteName: 'SM',
  tagline: 'A stack machine, as an alternative to the nand2tetris VM',
  nav: {
    home: 'Home',
    emulator: 'Emulator',
    compiler: 'Compiler',
    bridge: 'Bridge',
    reference: 'Reference',
    rationale: 'Rationale',
    projects: 'Projects',
  },
  blurb: {
    home: 'Every page in one place.',
    emulator: 'Run a program, a step at a time, with the stack, the frames and the memory.',
    compiler: 'Jack to SM, with the course’s own checks.',
    bridge: 'The same program on both machines, in either direction.',
    reference: 'The normative reference: the commands, the memory model, the frame, the errors.',
    rationale: 'Why this machine differs from the course’s, and what that costs.',
    projects: 'The two packages of exercises.',
  },
  run: 'Run',
  step: 'Step',
  reset: 'Reset',
  stack: 'Stack',
  frames: 'Frames',
  globals: 'Globals',
  ram: 'RAM',
  source: 'Source',
  program: 'The code after cleaning',
  notation: 'Notation',
  mnemonics: 'Mnemonics',
  words: 'Words',
  halted: 'halted',
  steps: 'steps',
  examples: 'Examples',
  courseTools: 'Links to the course’s own tools',
  p1: 'The first half of the translator: the commands that need no frame.',
  p2: 'The second: control flow, functions, and finally the bootstrap.',
  screen: 'Screen',
  keyboard: 'Keyboard',
  keyboardHint: 'Click here and type; the key goes to 24576.',
  jack: 'Jack source',
  compiled: 'The SM it compiles to',
  compile: 'Compile',
  sendToEmulator: 'Send to the emulator',
  library: 'Library',
  libraryOn: 'linked',
  noWarnings: 'No warnings.',
  download: 'Download',
  copyLink: 'Copy a link',
  copied: 'Link copied.',
  result: 'The result',
  smToVm: 'SM to VM',
  vmToSm: 'VM to SM',
  bridgeBlurb: 'What comes out runs in the course’s own emulator:',
  openFiles: 'Load a file',
  openFolder: 'Load a folder',
  downloadProjects: 'Download both folders',
  script: 'Test script',
  runTest: 'Run the test',
  output: 'Output',
  comparePassed: 'The comparison passed.',
  compareFailed: 'The comparison failed at line',
  noScript: 'This example has no test script.',
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { he, en }
