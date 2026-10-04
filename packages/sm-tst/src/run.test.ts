import { parseScript } from './script.js'
import { compare, runScript, type Host } from './run.js'

/** A host that keeps its files in memory. */
function host(files: Record<string, string>): Host & { written: Record<string, string> } {
  const written: Record<string, string> = {}
  return {
    scriptName: 'T.tst',
    written,
    read(name) {
      const text = files[name] ?? written[name]
      if (text === undefined) throw new Error(`no file named ${name}`)
      return text
    },
    write(name, text) { written[name] = text },
    listSources: () => Object.keys(files).filter((n) => n.endsWith('.sm')),
  }
}

describe('parseScript', () => {
  it('reads the course\'s shape', () => {
    const s = parseScript(`
      // a comment
      load Prog.asm,
      output-file Prog.out,
      compare-to Prog.cmp,
      output-list RAM[0]%D1.6.1 RAM[261]%D1.6.1;

      repeat 6000 {
        smstep;
      }

      output;
    `)
    expect(s.map((c) => c.kind)).toEqual([
      'load', 'output-file', 'compare-to', 'output-list', 'repeat', 'output',
    ])
  })

  it('reads a bare load as the whole directory', () => {
    expect(parseScript('load,\noutput;')[0]).toEqual({ kind: 'load' })
  })

  it('reads set', () => {
    expect(parseScript('set sp 261,')[0]).toEqual({ kind: 'set', target: 'sp', value: 261 })
  })

  it('refuses a command it does not know', () => {
    expect(() => parseScript('ticktock;')).toThrow(/not a command this runner knows/)
  })

  it('refuses an unclosed repeat', () => {
    expect(() => parseScript('repeat 3 { smstep;')).toThrow(/ends before its }/)
  })
})

describe('runScript', () => {
  it('runs a fragment and reports the cells asked for', () => {
    const h = host({ 'T.sm': '<-7\n<-8\n+' })
    const r = runScript(
      'load,\noutput-file T.out,\noutput-list RAM[0]%D1.6.1 RAM[256]%D1.6.1;\nrepeat 20 { smstep; }\noutput;',
      h,
    )
    expect(r.output).toBe('| RAM[0] |RAM[256]|\n|    256 |     15 |\n')
    expect(h.written['T.out']).toBe(r.output)
  })

  it('runs a whole program', () => {
    const h = host({
      'Sys.sm': '!Sys.init()\n<-20\n<-22\nadd2\n->answer\n<-0\n<--',
      'A.sm': '!add2(a,b)\n<-@a\n<-@b\n+\n<--',
    })
    const r = runScript(
      'load,\noutput-list RAM[16]%D1.6.1;\nrepeat 500 { smstep; }\noutput;',
      h,
    )
    // `answer` is the first global met, so it is the first cell handed out.
    expect(r.output.trimEnd().split('\n')[1]).toBe('|     42 |')
  })

  it('obeys set', () => {
    const h = host({ 'T.sm': '<-1' })
    const r = runScript('load,\noutput-list RAM[300]%D1.6.1;\nset RAM[300] 77,\noutput;', h)
    expect(r.output.trimEnd().split('\n')[1]).toBe('|     77 |')
  })

  it('reports a passing comparison', () => {
    const h = host({ 'T.sm': '<-7', 'T.cmp': '| RAM[0] |\n|    256 |\n' })
    const r = runScript('load,\ncompare-to T.cmp,\noutput-list RAM[0]%D1.6.1;\nrepeat 5 { smstep; }\noutput;', h)
    expect(r.comparison).toEqual({ ok: true })
  })

  it('reports a failing comparison with its line', () => {
    const h = host({ 'T.sm': '<-7', 'T.cmp': '| RAM[0] |\n|    999 |\n' })
    const r = runScript('load,\ncompare-to T.cmp,\noutput-list RAM[0]%D1.6.1;\nrepeat 5 { smstep; }\noutput;', h)
    expect(r.comparison).toEqual({ ok: false, line: 2 })
  })

  it('passes a diagnostic from the source through', () => {
    const h = host({ 'T.sm': '!f()\n-->Nowhere\n<--', 'Sys.sm': '!Sys.init()\n<-0\n<--' })
    expect(() => runScript('load,\noutput-list RAM[0]%D1.6.1;\noutput;', h))
      .toThrow(/unknown label - f\$Nowhere/)
  })
})

describe('compare', () => {
  // Measured on the course's emulator: one extra trailing space fails it.
  it('is exact, trailing space and all', () => {
    expect(compare('|  7 |\n', '|  7 | \n')).toEqual({ ok: false, line: 1 })
  })

  it('ignores carriage returns, which are an artefact of the editor', () => {
    expect(compare('|  7 |\n', '|  7 |\r\n')).toEqual({ ok: true })
  })
})

describe('a script that plants a frame', () => {
  // With no Sys.init there is nothing to bootstrap into, so the runner starts
  // at the first step and the script sets up what it needs. This is how the
  // course tests a function before the student has written a bootstrap.
  it('runs a function and leaves the result in the first argument slot', () => {
    const h = host({ 'A.sm': '!twice(n)\n<-@n\n<-@n\n+\n<--' })
    const r = runScript([
      'load,',
      'output-file A.out,',
      'output-list RAM[0]%D1.6.1 RAM[310]%D1.6.1;',
      'set RAM[310] 21,',   // the argument
      'set RAM[311] 0,',    // the caller's frame pointer
      'set RAM[312] 9999,', // a return address outside the program
      'set RAM[0] 312,',    // SP, from which the declaration derives LCL
      'repeat 100 { smstep; }',
      'output;',
    ].join('\n'), h)
    expect(r.output.trimEnd().split('\n')[1]).toBe('|    310 |     42 |')
  })
})
