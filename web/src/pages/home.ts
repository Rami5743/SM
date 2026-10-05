/**
 * The front page: what this site is for, what is on it, and who made it.
 *
 * The prose lives here rather than in i18n.ts, which carries the strings the
 * interface is built from. Each language gets its own text, not a word-for-
 * word rendering of the other, and the links into the site are built from
 * the route so the language the reader is in is the language they stay in.
 */
import { el } from '../lib/dom.js'
import type { PageId, Strings } from '../lib/i18n.js'
import { href, type Route } from '../lib/router.js'

const COURSE = 'https://www.nand2tetris.org/'
const NISAN = 'https://he.wikipedia.org/wiki/נועם_ניסן'
const SCHOCKEN = 'https://he.wikipedia.org/wiki/שמעון_שוקן'
// In English the two are linked to the pages they keep themselves.
const NISAN_EN = 'https://www.cs.huji.ac.il/~noam/'
const SCHOCKEN_EN = 'https://www.shimonschocken.com/'
const AVRAHAM = 'aizenr@gmail.com'
const MEIR = 'meir.aizenud@gmail.com'

export function homePage(route: Route, base: string, s: Strings): HTMLElement {
  /** A link to another page of this site, in the reader's language. */
  const to = (page: PageId, text: string) =>
    el('a', { href: href({ ...route, page }, base) }, text)
  const out = (url: string, text: string) => el('a', { href: url }, text)
  const mail = (address: string) =>
    el('a', { href: `mailto:${address}`, dir: 'ltr' }, address)

  const body = route.lang === 'he'
    ? hebrew(to, out, mail)
    : english(to, out, mail)
  return el('article', { dir: route.lang === 'he' ? 'rtl' : 'ltr' },
    el('h1', {}, s.tagline), ...body)
}

function hebrew(
  to: (page: PageId, text: string) => HTMLElement,
  out: (url: string, text: string) => HTMLElement,
  mail: (address: string) => HTMLElement,
): HTMLElement[] {
  return [
    el('p', {},
      'מטרת האתר היא לספק חלופה למכונה הווירטואלית שבקורס ',
      out(COURSE, 'From Nand to Tetris'),
      ' של ', out(NISAN, 'נועם ניסן'), ' ו', out(SCHOCKEN, 'שמעון שוקן'), '.'),
    el('p', {},
      'אנו קוראים לשפה הזאת SM (קיצור של מכונת מחסנית) כדי להבדיל אותה ',
      'מהשפה הווירטואלית של הקורס, VM (קיצור של מכונה וירטואלית). ',
      'בפועל שתי השפות הן שפות מכונה וירטואלית ושתיהן מבוססות על מחסנית.'),
    el('p', {},
      'אנחנו מקווים שהגרסה הזאת קלה יותר להבנה, למימוש ולשימוש, ',
      'ושהיא מדגישה טוב יותר את הרעיונות המרכזיים של הקורס.'),
    el('p', {}, 'אתם יכולים להשתמש באתר כדי לעשות את הקורס המקורי עם שני שינויים:'),
    el('ol', {},
      el('li', {},
        'במקום לכתוב מתרגם משפת VM לשפת אסמבלי, לכתוב מתרגם משפת SM לשפת אסמבלי.'),
      el('li', {},
        'במקום לכתוב קומפיילר משפת Jack לשפת VM, לכתוב קומפיילר משפת Jack לשפת SM.')),
    el('p', {},
      'אנחנו חושבים שהשינויים האלה יהפכו את הקורס למהנה וקל יותר ',
      'מבלי לפגוע בערך הלימודי שלו.'),

    el('h2', {}, 'מה יש באתר'),
    el('ol', {},
      el('li', {},
        to('emulator', 'אמולטור'),
        ' של שפת SM, מקביל לאמולטור של שפת VM של הקורס. ',
        'מאפשר לכם לשחק עם השפה ולהכיר אותה.'),
      el('li', {}, to('reference', 'תיעוד'), ' של שפת SM.'),
      el('li', {},
        to('projects', 'חבילת בדיקה'),
        ' לגרסה שלנו של משימות 7 ו‑8. מדובר בקוד SM שמקביל לקוד ה‑VM ',
        'שבמשימות 7 ו‑8 של הקורס. כשתכתבו מתרגם משפת SM לשפת אסמבלי, ',
        'תוכלו לבדוק אותו בכך שתריצו אותו על קובצי ה‑SM האלה ותבדקו את ',
        'התוצאה באמולטור ה‑CPU של הקורס. אנחנו מספקים גם את קובצי ה‑',
        el('code', {}, 'tst'),
        ' לצורך הבדיקה הזאת. שימו לב שאין חבילת בדיקה למשימה 11 ',
        '(כתיבת הקומפיילר): משימה 11 בקורס נועדה לבדיקה ידנית באמולטור, ',
        'כך שאת הגרסה שלנו למשימה 11 (כתיבת קומפיילר מ‑Jack ל‑SM) ',
        'תוכלו לבדוק באמולטור שלנו.'),
      el('li', {},
        to('bridge', 'מתרגמים'),
        ' משפת SM לשפת VM ובחזרה. הם מאפשרים לכם לתרגם את קובצי הקלט של ',
        'הקורס (שכתובים ב‑VM) ל‑SM, ואז להשתמש במתרגם שלכם לאסמבלי ולבדוק ',
        'את התוצאה במערכת הבדיקות של הקורס. הם מאפשרים גם לכתוב את ',
        'הקומפיילר ל‑SM, לתרגם את התוצאה ל‑VM ולבדוק אותה במערכת הבדיקות ',
        'של הקורס.'),
      el('li', {},
        to('compiler', 'קומפיילר'),
        ' מ‑Jack ל‑SM, מקביל לקומפיילר שיש בקורס מ‑Jack ל‑VM.'),
      el('li', {},
        to('rationale', 'הסבר'), ' על למה רצינו לעשות את השינוי הזה לקורס.')),

    el('p', {}, el('strong', {}, 'הבהרה'),
      ': האתר נעשה באופן עצמאי ואינו קשור לקורס המקורי. ',
      'יוצרי הקורס המקורי אינם אחראים לשום רכיב באתר.'),
    el('p', {}, el('strong', {}, 'אזהרה'),
      ': האתר והתוכנות שבו עדיין לא נבדקו באופן רציני. הם צפויים ',
      'להכיל שגיאות רבות. נשמח לשמוע עליהן ב‑', mail(AVRAHAM), '.'),

    el('hr'),
    el('p', {},
      'בין אם אתם מעוניינים להשתמש באתר הזה ובין אם לאו, אנחנו ממליצים ',
      'מאוד על הקורס ', out(COURSE, 'From Nand to Tetris'),
      ', שמספק חוויית למידה מהנה ומפתחת!'),

    el('hr'),
    el('p', {},
      'שפת SM פותחה על ידי אברהם איזנבוד (', mail(AVRAHAM),
      ') ומאיר איזנבוד (', mail(MEIR), '). ',
      'האתר מופעל על ידי אברהם איזנבוד. ',
      'תרגישו חופשי לפנות אלינו בכל שאלה בנושא.'),
  ]
}

function english(
  to: (page: PageId, text: string) => HTMLElement,
  out: (url: string, text: string) => HTMLElement,
  mail: (address: string) => HTMLElement,
): HTMLElement[] {
  return [
    el('p', {},
      'This site offers an alternative to the virtual machine of ',
      out(COURSE, 'From Nand to Tetris'), ', by ',
      out(NISAN_EN, 'Noam Nisan'), ' and ', out(SCHOCKEN_EN, 'Shimon Schocken'), '.'),
    el('p', {},
      'The language here is called SM, short for stack machine, to tell it ',
      'apart from the course’s own virtual language, VM. Both are virtual ',
      'machine languages and both are built on a stack.'),
    el('p', {},
      'We hope this version is easier to understand, to implement and to ',
      'use, and that it brings out the central ideas of the course better.'),
    el('p', {}, 'You can use this site to take the original course with two changes:'),
    el('ol', {},
      el('li', {},
        'Instead of writing a translator from VM to assembly, write a ',
        'translator from SM to assembly.'),
      el('li', {},
        'Instead of writing a compiler from Jack to VM, write a compiler ',
        'from Jack to SM.')),
    el('p', {},
      'We think these changes make the course more enjoyable and easier ',
      'without costing it any of its educational value.'),

    el('h2', {}, 'What is on this site'),
    el('ol', {},
      el('li', {},
        'An ', to('emulator', 'emulator'),
        ' for SM, the counterpart of the course’s VM emulator. It lets you ',
        'play with the language and get to know it.'),
      el('li', {}, 'The ', to('reference', 'reference'), ' for SM.'),
      el('li', {},
        'A ', to('projects', 'package of tests'),
        ' for our version of projects 7 and 8: SM code matching the VM code ',
        'of projects 7 and 8 of the course. Once you have written a ',
        'translator from SM to assembly, you can check it by running it on ',
        'these SM files and checking the result in the course’s CPU ',
        'emulator. The ', el('code', {}, '.tst'), ' files for those checks ',
        'come with the package. Note that there is no test package for ',
        'project 11, the compiler: project 11 is checked by hand in the ',
        'emulator, so our version of it — a compiler from Jack to SM — is ',
        'checked in our emulator.'),
      el('li', {},
        to('bridge', 'Translators'),
        ' from SM to VM and back. They let you translate the course’s own ',
        'input files, which are written in VM, into SM, run your own ',
        'translator to assembly on them and check the result with the ',
        'course’s test suite. They also let you write your compiler to SM, ',
        'translate its output to VM and check that with the course’s test ',
        'suite.'),
      el('li', {},
        'A ', to('compiler', 'compiler'),
        ' from Jack to SM, the counterpart of the course’s Jack to VM compiler.'),
      el('li', {},
        'An ', to('rationale', 'account'), ' of why we wanted this change to the course.')),

    el('p', {}, el('strong', {}, 'A note'),
      ': this site was made independently and is not connected to the ',
      'original course. The authors of the course are not responsible for ',
      'anything on it.'),
    el('p', {}, el('strong', {}, 'A warning'),
      ': the site and the programs on it have not yet been tested ',
      'seriously. They are likely to contain many errors. We would be glad ',
      'to hear about them at ', mail(AVRAHAM), '.'),

    el('hr'),
    el('p', {},
      'Whether or not you want to use this site, we warmly recommend ',
      out(COURSE, 'From Nand to Tetris'),
      ', which is an enjoyable and rewarding way to learn!'),

    el('hr'),
    el('p', {},
      'SM was designed by Avraham Aizenbud (', mail(AVRAHAM),
      ') and Meir Aizenbud (', mail(MEIR), '). ',
      'The site is run by Avraham Aizenbud. ',
      'You are welcome to write to us with any question about it.'),
  ]
}
