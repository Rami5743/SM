/**
 * The two exercise packages, bundled into the site so a student can take
 * them away in one file.
 *
 * `.out` files are excluded: they are what a run produces, and shipping one
 * would let a test look satisfied before it has run.
 */
const RAW = import.meta.glob('../../../projects/0[78]-sm/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Path inside the archive to contents, `07-sm/SimpleAdd/SimpleAdd.sm`. */
export const PACKAGES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RAW)
    .filter(([path]) => !path.endsWith('.out'))
    .map(([path, text]) => ({ name: path.replace(/^.*\/projects\//, ''), text }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, text }) => [name, text]),
)

/**
 * The tests of both packages, in the order their READMEs teach them: each
 * one assumes the ones before it.
 */
const ORDER: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['07-sm', ['SimpleAdd', 'StackTest', 'GlobalTest', 'PointerTest', 'StaticTest']],
  ['08-sm', ['BasicLoop', 'FibonacciSeries', 'SimpleFunction', 'NestedCall', 'StaticsTest', 'FibonacciElement']],
]

export interface Example {
  /** What the dropdown shows, `07-sm · SimpleAdd`. */
  readonly label: string
  readonly source: string
  /** The script that runs it here — `<Name>SM.tst`, not the one that runs
   *  the assembly a student produces. Absent if the test has none. */
  readonly script?: string
  /** The files the script needs beside the program, the `.cmp` above all. */
  readonly files: Readonly<Record<string, string>>
}

/** A test's `.sm` files, several of them headed by their names. */
function sourceOf(prefix: string): string {
  const parts = Object.entries(PACKAGES)
    .filter(([path]) => path.startsWith(`${prefix}/`) && path.endsWith('.sm'))
  if (parts.length === 1) return parts[0]![1]
  return parts.map(([path, text]) =>
    `// ${path.slice(prefix.length + 1)}\n${text.replace(/\n*$/, '\n')}`).join('\n')
}

function filesOf(prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(PACKAGES)
      .filter(([path]) => path.startsWith(`${prefix}/`))
      .map(([path, text]) => [path.slice(prefix.length + 1), text]),
  )
}

export const EXAMPLES: readonly Example[] = ORDER.flatMap(([pack, tests]) =>
  tests.map((test) => {
    const files = filesOf(`${pack}/${test}`)
    return {
      label: `${pack} · ${test}`,
      source: sourceOf(`${pack}/${test}`),
      script: files[`${test}SM.tst`],
      files,
    }
  }))
