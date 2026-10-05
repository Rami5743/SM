/**
 * The reference, as a Word file to edit.
 *
 *   node tools/md2docx.cjs spec/sm.he.md sm-he.docx he
 *   node tools/md2docx.cjs spec/sm.md    sm-en.docx en
 *
 * Markdown in, .docx out, for the handful of constructs spec/sm.md uses:
 * headings, paragraphs, bullets, tables, fenced code, inline code, bold,
 * italics, links, horizontal rules, and the one raw `<p dir="ltr">`.
 *
 * Direction is the whole reason this is not a one-line pandoc call. Every
 * paragraph is bidirectional so that Word lays a Hebrew line out right to
 * left; a run is marked right-to-left only if it actually holds Hebrew, so
 * that `<-@x` and `SP` keep their order; and the citation paragraph is left
 * to right outright.
 */
const fs = require('node:fs')
const {
  AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle,
} = require('docx')

const HEBREW = /[֐-׿]/
const CODE_FONT = 'Consolas'
const CONTENT_WIDTH = 9026 // A4 portrait less 1" margins, in DXA

/** Split a line into runs, honouring `code`, **bold**, *italic*, [link](url). */
function inline(text, base = {}) {
  const runs = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let at = 0
  const push = (piece, extra) => {
    if (piece === '') return
    runs.push(new TextRun({
      text: piece,
      rightToLeft: HEBREW.test(piece),
      ...base,
      ...extra,
    }))
  }
  for (const match of text.matchAll(pattern)) {
    push(text.slice(at, match.index))
    const whole = match[0]
    if (whole.startsWith('`')) {
      // Code keeps its own direction, whatever the paragraph does.
      runs.push(new TextRun({ text: whole.slice(1, -1), font: CODE_FONT, rightToLeft: false, ...base }))
    } else if (whole.startsWith('**')) {
      push(whole.slice(2, -2), { bold: true })
    } else if (whole.startsWith('[')) {
      const label = /\[([^\]]+)\]/.exec(whole)[1]
      push(label.replace(/`/g, ''), { font: CODE_FONT, rightToLeft: false })
    } else {
      push(whole.slice(1, -1), { italics: true })
    }
    at = match.index + whole.length
  }
  push(text.slice(at))
  return runs
}

function cellWidths(columns) {
  const each = Math.floor(CONTENT_WIDTH / columns)
  const widths = Array(columns).fill(each)
  widths[columns - 1] = CONTENT_WIDTH - each * (columns - 1)
  return widths
}

function tableOf(rows) {
  const columns = rows[0].length
  const widths = cellWidths(columns)
  return new Table({
    visuallyRightToLeft: true,
    columnWidths: widths,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    rows: rows.map((cells, r) => new TableRow({
      tableHeader: r === 0,
      children: cells.map((cell, c) => new TableCell({
        width: { size: widths[c], type: WidthType.DXA },
        shading: r === 0 ? { type: ShadingType.CLEAR, fill: 'F2F2F2' } : undefined,
        children: [new Paragraph({
          bidirectional: true,
          children: inline(cell, r === 0 ? { bold: true } : {}),
        })],
      })),
    })),
  })
}

function convert(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const children = []
  let i = 0

  const paragraph = (text, options) => new Paragraph({
    bidirectional: true,
    spacing: { after: 160 },
    children: inline(text),
    ...options,
  })

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    if (line.startsWith('```')) {
      i++
      const code = []
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++
      for (const [n, text] of code.entries()) {
        children.push(new Paragraph({
          bidirectional: false,
          alignment: AlignmentType.LEFT,
          spacing: n === code.length - 1 ? { after: 160 } : {},
          shading: { type: ShadingType.CLEAR, fill: 'F6F6F6' },
          children: [new TextRun({ text, font: CODE_FONT, rightToLeft: false })],
        }))
      }
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading !== null) {
      children.push(new Paragraph({
        bidirectional: true,
        heading: [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][heading[1].length - 1],
        spacing: { before: 280, after: 160 },
        children: inline(heading[2]),
      }))
      i++
      continue
    }

    if (/^---+$/.test(line.trim())) {
      children.push(new Paragraph({
        bidirectional: true,
        spacing: { before: 120, after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
        children: [],
      }))
      i++
      continue
    }

    // A raw HTML paragraph, which is in the file only to say `dir="ltr"`.
    if (line.startsWith('<p')) {
      const ltr = /dir="ltr"/.test(line)
      const block = []
      while (i < lines.length) { block.push(lines[i]); if (lines[i].includes('</p>')) break; i++ }
      i++
      const inner = block.join(' ')
        .replace(/^<p[^>]*>/, '')
        .replace(/<\/p>\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
      // Only <em> matters here, and a book title should keep its italics.
      const runs = []
      for (const piece of inner.split(/(<em>.*?<\/em>)/)) {
        if (piece === '') continue
        const emphasis = piece.startsWith('<em>')
        const text = piece.replace(/<[^>]+>/g, '')
        if (text === '') continue
        runs.push(new TextRun({ text, italics: emphasis, rightToLeft: false }))
      }
      children.push(new Paragraph({
        bidirectional: !ltr,
        alignment: ltr ? AlignmentType.LEFT : undefined,
        spacing: { after: 160 },
        children: runs,
      }))
      continue
    }

    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i]
          .replace(/^\||\|$/g, '')
          .split(/(?<!\\)\|/)
          .map((c) => c.trim().replace(/\\\|/g, '|'))
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) rows.push(cells)
        i++
      }
      if (rows.length > 0) {
        const columns = Math.max(...rows.map((r) => r.length))
        children.push(tableOf(rows.map((r) => [...r, ...Array(columns - r.length).fill('')])))
        children.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
      }
      continue
    }

    if (/^\*\s/.test(line)) {
      while (i < lines.length && (/^\*\s/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        let text = lines[i].replace(/^\*\s+/, '')
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) { text += ' ' + lines[i].trim(); i++ }
        children.push(new Paragraph({
          bidirectional: true,
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 80 },
          children: inline(text),
        }))
      }
      continue
    }

    // An ordinary paragraph: soft-wrapped lines are one paragraph.
    const block = []
    while (i < lines.length && lines[i].trim() !== ''
      && !lines[i].startsWith('|') && !lines[i].startsWith('```')
      && !lines[i].startsWith('<p') && !/^#{1,4}\s/.test(lines[i])
      && !/^---+$/.test(lines[i].trim()) && !/^\*\s/.test(lines[i])) {
      block.push(lines[i].trim())
      i++
    }
    children.push(paragraph(block.join(' ')))
  }

  return children
}

const [, , input, output, langArg] = process.argv
const rtl = langArg === 'he'
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: rtl ? 'Arial' : 'Calibri', size: 22 } },
    },
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        style: { paragraph: { indent: { start: 480, hanging: 240 } } },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: convert(fs.readFileSync(input, 'utf8')),
  }],
})

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(output, buffer)
  console.log(`${output}: ${buffer.length} bytes`)
})
