#!/usr/bin/env node
/**
 * Run a .tst script. Prints what the course's tools print, so that a student
 * moving between them reads the same words.
 */
import { runScriptFile } from './node-host.js'

const script = process.argv[2]
if (script === undefined) {
  console.error('usage: sm-tst <script.tst>')
  process.exit(2)
}

try {
  const result = runScriptFile(script)
  if (result.comparison === undefined) {
    console.log('End of script')
  } else if (result.comparison.ok) {
    console.log('End of script - Comparison ended successfully')
  } else {
    console.error(`Comparison failure at line ${result.comparison.line}`)
    process.exit(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
