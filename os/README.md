# The standard library

`Math`, `String`, `Array`, `Memory`, `Screen`, `Output`, `Keyboard`, `Sys`,
in SM.

`jack/` is the source, in ordinary Jack. `sm/` is what our own compiler makes
of it, checked in so that nothing has to be compiled to build the site.
`npm run build:os` regenerates `sm/` and the module the emulator carries;
`tools/src/os-build.test.ts` fails if either is stale, so the two cannot
drift.

## Why it is written in Jack

Because the course's is, and because it makes the library the compiler's
largest test. Nothing here is privileged: it is compiled by the same
compiler, with the same checks, and it is read, stepped through and replaced
in the emulator like any other SM. That is what project 12 asks a student to
do — replace one class and keep the rest — and `jack-os.test.ts` checks that
replacing one really does supplant the library's.

## What the emulator does with it

The course's VM emulator ships built-in implementations of the eight classes
and uses one wherever the program does not supply its own. Ours does the
same, with `load(files, { library: true })`, except that there is nothing
built in: `library.ts` picks the SM files the program reaches and does not
define itself, and links them as ordinary SM.

Only what the program reaches is linked, by whole classes as the course
substitutes by whole classes. In practice a program that calls anything at
all gets all eight — every class can fail, every failure is `Sys.error`, and
`Sys.init` starts all of them — but a program that calls none of it carries
none of it, which is what projects 7 and 8 need.

## Where it departs from the course's

* **`Memory.peek` and `Memory.poke`.** The trick is the course's own — an
  array based at address 0 — but in SM `memory[address]` is
  `<- @memory  <- @address  +  []`: an address on the stack and one
  instruction, with no `pointer` to set and no `that` to re-point. The whole
  of `peek` is four instructions.
* **The character map in `Output`** is the course's, from its own
  `projects/12/Output.jack`, with one change: the course leaves the letter
  `A` blank as the book's worked example, and we fill it in.
* **`Screen.drawRun` and `Screen.drawVertical`** carry the screen address
  along the loop instead of calling `drawPixel`, which takes the
  multiplication and the division out of the inner loop. Drawing is most of
  what the library does, and `Math.multiply` is sixteen iterations.

There is no `Sys.wait` that waits a real millisecond: it counts, like the
course's, and the count means whatever the host's speed makes of it.
