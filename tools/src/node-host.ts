/**
 * The command-line side of the .tst runner: the same runner the site uses,
 * with the file system behind it.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { runScript, type Host, type RunResult } from '@sm/tst'

export function nodeHost(scriptPath: string): Host {
  const dir = dirname(scriptPath)
  return {
    scriptName: basename(scriptPath),
    read: (name) => readFileSync(join(dir, name), 'utf8'),
    write: (name, text) => writeFileSync(join(dir, name), text),
    listSources: () => readdirSync(dir).filter((n) => n.endsWith('.sm')).sort(),
  }
}

export function runScriptFile(scriptPath: string): RunResult {
  return runScript(readFileSync(scriptPath, 'utf8'), nodeHost(scriptPath))
}
