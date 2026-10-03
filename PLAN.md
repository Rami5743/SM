# Work plan

An online replacement for the virtual-machine part of nand2tetris, built around
the SM stack machine.

Companion document: [`spec/INVENTORY.md`](spec/INVENTORY.md) — what the supplied
material contains, how the existing Python translator actually behaves, and the
eight specification questions (**Q1**–**Q8**) that have to be answered before
coding starts. This plan refers to them by number.

---

## 1. What we are building

| # | Deliverable | Form |
|---|---|---|
| 1 | SM emulator | In-browser, no server |
| 2 | SM → VM and VM → SM translators | In-browser, plus a command-line entry point |
| 3 | Jack → SM compiler | In-browser, plus a command-line entry point |
| 4 | SM reference page and rationale page | Static pages of the same site |
| 5 | `projects/07-sm/` | A directory of tests the student downloads |

Everything runs client-side. The site is a static bundle on GitHub Pages; there
is no backend, no account, and no upload. A student can also clone the
repository and run every tool from the command line, which is what continuous
integration does.

Of these, (5) is the one the course actually assigns: the student writes an
SM → Hack-assembly translator. (1)–(3) are the scaffolding that makes that
assignment possible and lets the SM track interoperate with the rest of the
course.

## 2. Principles

* **The emulator is the specification.** Prose has already drifted from code
  three times in the supplied material (Q1, Q2, Q3). One executable artefact is
  normative, and the reference page is generated from, or tested against, it.
* **No hidden second pass.** SM's call convention was designed so that an
  SM → assembly translator needs neither a function table nor a second pass
  (see `spec/INVENTORY.md` §2). Our reference translator must honour that, or
  the student's assignment is harder than the design claims.
* **The student never needs our source.** The package in (5) is self-contained:
  SM sources, the emulator, `.tst` scripts, `.cmp` files. Our SM → assembly
  translator is a build tool for generating `.cmp` files and is not shipped.
* **Round trips are the test suite.** SM → VM → SM and VM → SM → VM over the
  course's own project 7/8 programs, compared by emulator output rather than by
  text, is a stronger correctness statement than any set of unit tests, and it
  is what proves the SM track is a genuine alternative rather than a fork.

## 3. Technical choices

TypeScript throughout, compiled by Vite, with Vitest for tests. One repository,
several packages, no runtime dependencies in the language tooling itself. The
Python prototypes are ported, not wrapped: a browser cannot run them, and
rewriting is cheaper than maintaining a translation layer.

Proposed layout:

```
spec/            the normative language reference (Markdown) + the LaTeX original
packages/
  sm-core/       lexer, parser, AST, diagnostics, pretty-printer (Q6)
  sm-emulator/   the interpreter and its Hack RAM model
  sm-tst/        the .tst script runner, shared by the site and the CLI
  sm-to-vm/
  vm-to-sm/
  jack-to-sm/
  sm-to-asm/     reference translator — build tool, not shipped to students
  hack/          Hack assembler + CPU emulator, needed to check .asm output
web/             the site
projects/07-sm/  the student package
reference/       the supplied material, verbatim
tools/           .cmp generation, CI scripts
```

`packages/hack/` is unavoidable: the Python translator imports an `asembly_OO`
module that was never supplied, and generating a `.cmp` for a student's `.asm`
means assembling and running Hack code ourselves. It is a small, well-specified
piece of work with a published reference implementation to check against.

## 4. Milestones

Each milestone ends in something runnable. The estimates are relative sizes, not
calendar time.

### M0 — Decide the specification *(small)*

Answer Q1–Q8. Write `spec/sm.md` as the normative reference: grammar, memory
model, frame layout, the exact statement of where `SP` points, the
most-significant-bit boolean convention, error conditions. Carry over the
corrections in `spec/INVENTORY.md` §5.

*Done when:* `spec/sm.md` covers every command in `reference/tst/all_cmds.sm`
and every open question is closed in writing.

### M1 — `sm-core` *(small)*

Lexer, parser, AST, source positions, a diagnostic type. One quirk to preserve
deliberately: the reference parser strips all spaces and tabs from a line, so
`? --> loop` and `?-->loop` are the same command. Keep that, and say so.

*Done when:* every sample in `reference/` parses, and a pretty-printer
round-trips them.

### M2 — `sm-emulator` *(medium)*

An interpreter over a 32K 16-bit RAM image laid out exactly as
`spec/INVENTORY.md` §2 describes, so that a RAM dump taken from the SM emulator
and one taken from the Hack CPU emulator running the student's `.asm` are
comparable cell for cell. Step, run, reset, breakpoints. A trace of the frame
stack recovered from `LCL` and the declarations.

*Done when:* `FibonacciElement` in SM computes the right value, and the RAM
image after each step matches the one produced by running the output of
`sm-to-asm` through `packages/hack/`.

### M3 — `sm-tst` and `packages/hack` *(medium)*

The `.tst` scripting language of the course, as far as our tools need it:
`load`, `output-file`, `compare-to`, `output-list RAM[i]%D1.6.1`, `set`,
`repeat { }`, `output`, and a `smstep` command standing where the course's
`vmstep` stands. The same runner drives the browser and the CLI. Alongside it, a
Hack assembler and CPU emulator, so a `.tst` naming a `.asm` file runs too.

*Done when:* one `.cmp` file is satisfied both by `smstep` over the `.sm`
sources and by `ticktock` over the assembled output of `sm-to-asm`. That
equivalence is the whole premise of deliverable (5).

### M4 — `sm-to-asm`, the reference translator *(medium)*

A clean port of `SM_trnsleitor3.py`. It stays out of the shipped site; its job
is to generate `.cmp` files and to be the thing a student's translator is
measured against.

*Done when:* its output agrees with the Python original on every sample, except
where an answer to Q1–Q8 deliberately changed the behaviour.

### M5 — The site, first cut *(medium)*

Pages: Emulator, Reference, Rationale. The emulator page loads a folder of `.sm`
files, runs them, shows the stack, the frame chain, the globals and raw RAM, and
highlights the current line.

* **Reference** is `spec/sm.md`, rendered, with a live "try it" box per command.
* **Rationale** follows the design letter: a virtual machine should be generic
  rather than shaped by one language's implementation; the stack should carry
  *all* computation, pointers included, which is what `[]` and `->[]` buy and
  what removes the `pointer`/`this`/`that` segments; symbolic variables rather
  than numeric addresses, since the language is textual anyway; a single frame
  pointer, since the offset between arguments and locals is known at translation
  time; globals and statics separated by naming convention rather than by two
  segments; and a boolean convention that makes `<`, `>`, `==` branch-free.
  It should state the costs honestly too — re-deriving `this` on every field
  access is slower than the course's constant `this`, offset partly by cheaper
  calls — and present Q6, the mnemonics, as the open question it is.

*Done when:* the three pages are live on GitHub Pages and the emulator runs
`FibonacciElement` from a cold load.

### M6 — `projects/07-sm`, the student package *(medium)* — **the deliverable that matters**

A staged sequence of tests. Each is a directory containing SM source, a
`<Name>SM.tst` that runs it in the SM emulator, a `<Name>.tst` that loads the
`<Name>.asm` the student is expected to produce, one `<Name>.cmp` shared by
both, and a README stating what the stage adds.

| Stage | Tests | What it exercises |
|---|---|---|
| 1 | `SimpleAdd`, `StackTest` | the stack, all arithmetic and logic, the boolean convention |
| 2 | `GlobalTest`, `StaticsTest` | global variables, and statics by dotted name (Q7) |
| 3 | `PointerTest`, `ArrayTest` | `[]` and `->[]`, including the operand order of Q1 |
| 4 | `BasicLoop`, `FibonacciSeries` | labels, `-->`, `?-->` |
| 5 | `SimpleFunction`, `NestedCall` | one frame, then frames that must survive a call |
| 6 | `FibonacciElement` | several files, recursion, `Sys.init` |

Every `.cmp` is generated by `tools/`, never copied from the course. The
supplied `FibonacciElement` pair is stale in three separate ways
(`spec/INVENTORY.md` §4) and is not a starting point.

*Done when:* for each test, `smstep` and `ticktock` over the reference `.asm`
both satisfy the `.cmp`, and a deliberately broken translator fails it.

### M7 — `sm-to-vm` and `vm-to-sm` *(large)*

The two directions are not symmetric, and the asymmetries are the interesting
part.

**SM → VM.** Needs a function table, hence two passes: the course VM writes the
argument count at the *call* site, where SM does not have it. Globals map to
`static` of a synthetic file, dotted names to the static of the file they name
(Q7). `[]` becomes `pop pointer 1; push that 0`; `->[]`, with the address below
the value, becomes `pop temp 0; pop pointer 1; push temp 0; pop that 0`.

The boolean conventions differ and this is where the work is. SM gives meaning
to the most significant bit alone; the VM uses all-bits `0` and `-1`. Emitting
`lt`, `gt`, `eq` for `<`, `>`, `==` produces canonical VM values, and `and`,
`or`, `not` are bitwise in both. The gap is the conditional jump: `if-goto`
branches on "non-zero", `?-->` on "negative". So `?--> L` must become
`push constant 0; lt; if-goto L`. A second gap: SM's `<` is a subtraction and so
disagrees with VM `lt` on overflow. Both gaps belong in the test suite and in a
"differences" section of the reference page, not in a footnote.

**VM → SM.** The segments collapse: `argument i` and `local i` become named SM
locals, with the counts recovered by scanning each function body for the largest
index used — `function f k` gives the local count but nothing gives the argument
count except the call sites. `static i` becomes the global `File.i`; `temp i`
becomes a reserved global; `this`, `that`, `pointer` become reserved globals
plus `[]` and `->[]`, which is precisely the translation the design argues for.
VM `if-goto L` becomes `<-0 / == / ~ / ?--> L`: equal-to-zero, negated, tested
on the most significant bit.

*Done when:* for every program in the course's projects 7 and 8, SM → VM → SM
and VM → SM → VM both preserve the emulator's output.

### M8 — `jack-to-sm` *(large)*

Port `jack_compaler.py` to TypeScript: tokenizer, full Jack grammar, symbol
table over static / field / argument / local, fields reached through `this` with
`[]` and `->[]`. Resolve Q4 — the `do` statement's discarded return value —
rather than inheriting the prototype's global named `tmp`.

The real work is the operating system. Jack programs need `Math`, `String`,
`Array`, `Memory`, `Screen`, `Output`, `Keyboard`, `Sys`. The standard library
is itself written in Jack, so compiling it to SM is mostly mechanical; `Memory`
is the exception, since `peek` and `poke` become `[]` and `->[]` directly.
Screen and keyboard need the emulator to own a Hack screen buffer and a keyboard
register, which is an addition to M2.

*Done when:* the course's project 11 programs compile to SM and run in the SM
emulator with the same visible behaviour as their VM versions.

### M9 — Polish *(small)*

Save and share a program by URL. Export a session as a downloadable folder.
Import a course `.vm` directory and see it as SM, and the reverse — the most
direct way to show a student that the two machines are the same machine. A
difference table between SM and the course VM. Continuous integration running
every `.tst` on every push.

## 5. Order of work

M0 → M1 → M2 → M3 → M4 → M6 is the critical path: it ends with the student
package, which is the point of the exercise. M5 can proceed alongside M2–M4.
M7 and M8 are independent of each other and both depend on M1–M3.

A reasonable first release is M0–M6 plus the Reference and Rationale pages: at
that point the unit-7 replacement is complete and usable on its own. The
translators and the Jack compiler extend it to the rest of the course.

## 6. Risks

* **`.cmp` files that do not hold.** Deliverable (5) rests on the SM emulator
  and the student's assembly output agreeing cell for cell. M3's acceptance
  criterion is written to force that agreement early, before a dozen tests have
  been authored against a wrong assumption.
* **Boolean conventions.** The most-significant-bit convention is the sharpest
  break from the course VM, and the place where a translator silently produces
  wrong answers rather than failing. It needs tests of its own, not just
  coverage inside larger programs.
* **Scope of the Jack OS.** M8 could absorb unlimited time through `Screen` and
  `Output`. If it does, ship M0–M7 first; the Jack compiler is the one
  deliverable the unit-7 package does not depend on.
* **Prose drifting from code again.** Mitigated by making the reference page a
  rendering of the normative spec, with its examples executed by the emulator at
  build time.

## 7. Questions for the author

1. Q1–Q8 in `spec/INVENTORY.md`, in particular Q3 (`Sys.init` jumped to or
   called), Q4 (discarding a return value) and Q6 (mnemonics or words).
2. Is the student expected to write **only** the SM → assembly translator, or
   also, as a later exercise, one of the SM ↔ VM translators?
3. Should the site host the course's own VM emulator as well, so a student can
   compare the two machines side by side, or only link to it?
4. Language of the site: English throughout, or English reference with a Hebrew
   rationale?
