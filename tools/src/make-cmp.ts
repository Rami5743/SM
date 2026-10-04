#!/usr/bin/env node
/**
 * Generate the .cmp of every test in the student packages.
 *
 * A .cmp is never written by hand and never copied from the course. It is
 * what the reference translator and the emulator actually produce, so that
 * the file a student is measured against cannot drift from the tools.
 *
 * For each test directory:
 *   1. translate its .sm with the reference translator, writing <Name>.asm
 *      into a scratch copy — the student writes their own, and the shipped
 *      directory must not contain ours;
 *   2. run <Name>SM.tst through our runner, which produces the output rows;
 *   3. write those rows as <Name>.cmp.
 *
 * The .asm side is then checked separately, by the suite, through the
 * course's own assembler and CPU emulator.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runScript } from '@sm/tst'
import { nodeHost } from './node-host.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

export interface TestCase {
  readonly dir: string
  readonly name: string
}

/** Every test directory of a package, in order. */
export function testsIn(packageDir: string): TestCase[] {
  return readdirSync(packageDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ dir: join(packageDir, e.name), name: e.name }))
    .filter((t) => existsSync(join(t.dir, `${t.name}SM.tst`)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Run a test's SM script and return the rows it produced. */
export function runSmScript(test: TestCase): string {
  const script = join(test.dir, `${test.name}SM.tst`)
  return runScript(readFileSync(script, 'utf8'), nodeHost(script), { skipCompare: true }).output
}

export function generate(packageDir: string): string[] {
  const written: string[] = []
  for (const test of testsIn(packageDir)) {
    const output = runSmScript(test)
    const cmp = join(test.dir, `${test.name}.cmp`)
    writeFileSync(cmp, output)
    written.push(cmp)
  }
  return written
}

if (basename(process.argv[1] ?? '') === 'make-cmp.ts' || process.argv[2] !== undefined) {
  const dirs = process.argv.slice(2)
  const packages = dirs.length > 0 ? dirs : ['projects/07-sm', 'projects/08-sm']
  for (const p of packages) {
    for (const file of generate(join(root, p))) {
      console.log(file.slice(root.length + 1))
    }
  }
}
