# Work plan

An online replacement for the virtual-machine part of nand2tetris, built around
the SM stack machine.

Companion document: [`spec/INVENTORY.md`](spec/INVENTORY.md) — what the supplied
material contains, how the existing Python translator actually behaves, and the
specification questions (**Q1**–**Q9**) that have to be answered before coding
starts. This plan refers to them by number.

---

## 1. What we are building

| # | Deliverable | Form |
|---|---|---|
| 1 | SM emulator | In-browser, no server |
| 2 | SM → VM and VM → SM translators | In-browser, plus a command-line entry point |
| 3 | Jack → SM compiler | In-browser, plus a command-line entry point |
| 4 | SM reference page and rationale page | Static pages of the same site |
| 5 | `projects/07-sm/` | First assignment, part I: a directory of tests the student downloads |
| 6 | `projects/08-sm/` | First assignment, part II |
| 7 | `projects/11-sm/` | Second assignment |

Everything runs client-side. The site is a static bundle on GitHub Pages; there
is no backend, no account, and no upload. A student can also clone the
repository and run every tool from the command line, which is what continuous
integration does.

**Two of these are assignments; the rest is scaffolding.** The student writes
exactly two programs: an **SM → Hack-assembly translator**, replacing projects
7–8, and then a **Jack → SM compiler**, replacing project 11. Deliverables
(5)–(6) are the first assignment, split into two parts as the course splits it,
and (7) is the second. The SM ↔ VM translators are never assigned —
they exist so that a program can cross between the SM track and the course's own
track, and so that each machine can be used to check the other.

That second assignment is what makes the Jack half of the project mandatory
rather than optional, and it pulls one thing onto the critical path that would
otherwise have been polish: **the Jack operating system, compiled to SM**. A
student's own compiler emits calls to `Math.multiply`, `String.new`,
`Output.printString`; the course supplies the library as `.vm` files, so we must
supply it as `.sm` files, and the emulator must own a screen buffer and a
keyboard register for it to drive. Deliverable (7) cannot exist without that
library, and the library is useless without those two devices.

## 2. Principles

* **The emulator is the specification.** Prose has already drifted from code
  three times in the supplied material (Q1, Q2, Q3), and Q1 was settled in the
  code's favour. One executable artefact is normative, and the reference page is
  generated from, or tested against, it.
* **No hidden second pass.** SM's call convention was designed so that an
  SM → assembly translator needs neither a function table nor a second pass
  (see `spec/INVENTORY.md` §2). Our reference translator must honour that, or
  the student's assignment is harder than the design claims.
* **The student never needs our source.** Each package is self-contained:
  sources, the emulator, `.tst` scripts, `.cmp` files. Our own SM → assembly
  translator is a build tool for generating `.cmp` files, and is not shipped.
  The Jack → SM compiler is different: the course ships a reference compiler
  alongside project 11 precisely so a student can compare, and we do the same.
* **Round trips are the test suite.** SM → VM → SM and VM → SM → VM over the
  course's own project 7/8 programs, compared by emulator output rather than by
  text, is a stronger correctness statement than any set of unit tests, and it
  is what proves the SM track is a genuine alternative rather than a fork.
* **Validating the input is our job, not the student's.** Our tools — the
  emulator, `sm-core`, our own translator and compiler — check that an `.sm`
  program is well formed and say precisely what is wrong with it when it is not.
  The student's translator is never required to do any of that, exactly as the
  course never requires it: its test programs are error-free by construction and
  a translator may assume so. The consequence is a rule for M6, written out
  there: no test in the student package feeds a malformed program and expects a
  diagnostic.
* **Each assignment is checked the way the course checks it, and no harder.**
  The course automates project 7–8 with `.cmp` files and deliberately does not
  automate project 11: there the student runs the compiled program and looks at
  it. We copy both choices rather than improve on either. Our own tests are a
  separate matter — see M7.

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
projects/07-sm/  first assignment, part I: commands without frames
projects/08-sm/  first assignment, part II: control flow, functions, bootstrap
projects/11-sm/  second assignment: the Jack to SM compiler
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

Answer the questions still open. Three points are settled and recorded in
`spec/CORRECTIONS.md`, which is the normative list of our deviations from
`reference/`: **C1**, the operand order of `->[]` follows the implementations —
address below, value on top — and the prose is corrected to match; **C2**, the
bootstrap sets `SP = 255`, so the stack starts at `RAM[256]`; **C3**, the
equality mnemonic is `==` and `=` is an error, which in turn requires that every
called name resolve to a declared function — without that check the parser's
catch-all rule turns any typo into a jump to a garbage address; **C4**, the
mnemonics are the language and the word forms are a rendering the emulator
offers, with the arithmetic and logical operators left symbolic in every view;
**C5**, constants are non-negative as in the course, negation is `(-)`, and an
empty operand is an error rather than something the catch-all rule swallows.

Two further questions closed without a correction entry, because both keep
`reference/` as it is: **Q3**, the bootstrap performs a full call to `Sys.init`
rather than a jump — the bootstrap is a call like every other call, with no
exception to teach and none to implement — and **Q4**, neither SM nor Jack
gains anything, a discarded return value staying the compiler's own business.

Write `spec/sm.md` as the normative reference: grammar, memory model, frame
layout, the exact statement of where `SP` points, the most-significant-bit
boolean convention, error conditions. Carry over `spec/CORRECTIONS.md` and the
prose corrections in `spec/INVENTORY.md` §5.

*Done when:* `spec/sm.md` covers every command in `reference/tst/all_cmds.sm`
and every question in `spec/INVENTORY.md` §3 is closed in writing.

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

The memory-mapped devices — a screen buffer and a keyboard register at the Hack
addresses — belong here rather than in a later milestone. They are cheap now and
they are a prerequisite for M7, where the Jack library drives them.

**A defined reset state.** All of RAM is zero at reset, as the course's CPU
emulator does it — measured, not assumed. The bootstrap then sets `SP`; `LCL`,
`ARG`, `THIS` and `THAT` are never touched by SM and stay zero. Without a rule
here the value the bootstrap pushes from the uninitialised `LCL` is arbitrary
and every `.cmp` covering that cell is unreliable. `packages/hack/` inherits
the behaviour from the tool it reimplements.

**Check the stack before running, and bound it while running.** Before
execution, walk each function and compute the depth of the stack above its
locals at every point; paths that meet at a label must agree, and `<--` must
find exactly one value (Q9). That reports a compiler whose statement calls leave
a cell behind — otherwise invisible until a game loop has corrupted the heap —
with the function and the disagreeing paths named, before the program runs. At
run time, `SP` passing 2047 is an overflow into the heap and is reported as
such: a backstop for runaway recursion, which no static walk can bound.

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
equivalence is the whole premise of the student packages.

### M4 — `sm-to-asm`, the reference translator *(medium)*

A clean port of `SM_trnsleitor3.py`. It stays out of the shipped site; its job
is to generate `.cmp` files and to be the thing a student's translator is
measured against.

*Done when:* its output agrees with the Python original on every sample, except
at the points listed in `spec/CORRECTIONS.md` — which, for this milestone,
means C2 and nothing else.

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

### M6 — `projects/07-sm` and `projects/08-sm`, the first assignment *(medium)*

Two packages, as the course has two projects. The split is what makes the
assignment tractable: part I is the commands that need no frame, part II is
frames, control flow and the bootstrap, which is the hard half.

**Every program in both packages is valid SM, and nothing here grades error
handling.** The validation we build — undeclared call targets (C3), the name
rules (Q5), the stack-depth walk (Q9) — belongs to our tools and exists so that
a student can tell a bad `.sm` file from a bug in the translator they are
writing. It is not part of the assignment, and a test that fed a malformed
program and expected a message would be quietly assigning work the course never
assigns.

Each test is a directory containing SM source, a `<Name>SM.tst` that runs it in
the SM emulator, a `<Name>.tst` that loads the `<Name>.asm` the student is
expected to produce, one `<Name>.cmp` shared by both, and a README stating what
the stage adds.

**Part I — `projects/07-sm/`.** Constants, globals, the arithmetic and logical
operators, `[]` and `->[]`. One file at a time, no bootstrap.

| Test | What it exercises | Course counterpart |
|---|---|---|
| `SimpleAdd` | the stack, one operator | `SimpleAdd` |
| `StackTest` | all nine arithmetic and logical commands, and the most-significant-bit boolean convention | `StackTest` |
| `GlobalTest` | `<- x` and `-> x` | `BasicTest` |
| `PointerTest` | `[]` and `->[]`, including the operand order of C1 | `PointerTest` |
| `StaticTest` | a dotted name is an ordinary global, the `.` being a character a symbol may contain | `StaticTest` |

**Part II — `projects/08-sm/`.** Labels, `-->`, `?-->`, the declaration, the
call, `<--`, the bootstrap, several files at once — and local variables, for the
reason below.

| Test | What it exercises | Course counterpart |
|---|---|---|
| `BasicLoop` | a label, `-->`, `?-->` | `BasicLoop` |
| `FibonacciSeries` | the same, over an array | `FibonacciSeries` |
| `SimpleFunction` | one declaration, locals, `<--` | `SimpleFunction` |
| `NestedCall` | a frame surviving a call | `NestedCall` |
| `FibonacciElement` | several files, recursion, `Sys.init`, the bootstrap | `FibonacciElement` |
| `StaticsTest` | the same globals reached from several files, inside functions | `StaticsTest` |

**Where the split falls differently from the course, and why.** The course puts
`push local 0` in project 7, because a local there is a numeric offset from a
pointer the `.tst` file sets by hand. SM cannot do that: `<- @x` names a local,
and the name is resolved against the function's declaration at translation time,
so a local has no meaning outside a function. Locals therefore move to part II,
with the declaration that gives them meaning.

The same property makes part I's test files simpler than the course's. A
project-7 `.tst` has to set five segment pointers before it can run anything;
ours sets `SP` and nothing else, because there is nothing else to set.

**One liberty, the same one the course takes.** A part-I file is a bare sequence
of commands with no function declaration, which the specification does not
permit — a file "must start with a functions declaration". The course's
project-7 `.vm` files are not legal complete VM programs either, for the same
reason and to the same end. The reference page should name this as a teaching
form rather than let a student discover the inconsistency: in part I the
emulator accepts a *fragment*, and from part II onward only whole programs.

Every `.cmp` is generated by `tools/`, never copied from the course. The
supplied `FibonacciElement` pair is stale in three separate ways
(`spec/INVENTORY.md` §4) and is not a starting point.

*Done when:* for each test in both packages, `smstep` and `ticktock` over the
reference `.asm` both satisfy the `.cmp`, and a deliberately broken translator
fails it.

### M7 — `jack-to-sm` and the Jack library in SM *(large)*

Two halves, and the second is the larger.

**The front end, as a milestone of its own.** One tokenizer and one parser,
producing an **AST with source positions**, used by everything downstream. This
is written fresh and tested well beyond what project 10 asks, with the
prototype as a reference rather than a basis — the author's instruction, and
the prototype bears it out:

* *There are two parsers and no AST.* `parser.py` walks the tokens and writes
  XML; `jack_compaler.py` walks the tokens again and writes SM directly. The
  grammar is implemented twice and a fix to one does not reach the other. With
  no tree in between there is nowhere to put a resolution pass, nowhere to hang
  a source position, and no way to test parsing apart from code generation.
* *They have already diverged.* `parser.py` tests for `"fild"` where
  `jack_compaler.py` correctly tests for `"field"`, so the XML parser has not
  parsed a class with fields for some time.
* *Passing project 10 is not the bar, and in fact it no longer passes.* The
  tokenizer labels its tokens `integrConstant` and `StringConstant`, where the
  course's compare files expect `integerConstant` and `stringConstant`.
* *The tokenizer carries no positions*, so no message from any later stage can
  point at a line. It also indexes one past the end when a keyword ends the
  file, drops a `//` comment that is not newline-terminated, and returns `None`
  — an unpacking crash with no message — on a character it does not recognise.

What we need beyond project 10's bar: positions on every node, a diagnostic
rather than a crash on malformed input, and a tree that a symbol-resolution
pass can run over before anything is emitted. Tested by round-tripping the
pretty-printer, by a case per grammar production, and by a corpus of malformed
inputs that must each produce a located message.

Writing a parser is not the task; the compiler is. This is a milestone on the
way, and it is sized accordingly.

**The compiler.** Over that tree: a symbol table across static / field /
argument / local, fields reached through `this` with `[]` and `->[]`, and code
generation per construct. Q4 is settled — a statement call's value is discarded,
and where it goes is this compiler's own business.

It also carries the two checks the official compiler carries, both of which the
prototype lacks and both of which its own sample trips
(`spec/INVENTORY.md` §4a): an unqualified call is a method call and is an error
inside a `function`, and control must not be able to reach the end of a
subroutine without a `return` — the flow analysis written out in full as C6,
and a rejection rather than an inserted return. The SM emulator carries the
course's companion runtime check, also C6. Matching the book here, not
exceeding it.

**The library.** `Math`, `String`, `Array`, `Memory`, `Screen`, `Output`,
`Keyboard`, `Sys`, available as `.sm` files. The standard implementations are
themselves written in Jack, so most of this is compiling them with the compiler
above, once it works. `Memory` is the exception and the interesting case:
`peek` and `poke` are not library calls in SM, they are the instructions `[]`
and `->[]`, which is the clearest single illustration of what the design buys.
`Screen` and `Output` need the devices added in M2.

This library is not optional and not polish. A student who writes their own
Jack → SM compiler can run nothing at all without it.

**Testing it.** The course hands project 11 to the student with no automated
tests at all, which is the right call for a student and the wrong one for us: a
compiler is where a silent, narrow bug survives longest, and ours is the
reference that every student's work will be compared against. So the compiler
gets a test suite the student package does not:

* *Per-construct tests.* One tiny Jack program per grammar construct and per
  symbol kind — a field read, an array store, a method call on an expression, a
  static across files, unary minus on a call — each leaving a known value in a
  known global, compiled, run, asserted. This is the layer that catches the
  narrow bugs.
* *Stack discipline.* Every compiled function passes the static depth check of
  Q9: depth determined by program point, one value above the locals at `<--`.
  This is the layer that catches a statement call whose result is left behind —
  a bug invisible to every other layer until a loop has run long enough to walk
  into the heap. Running the check over our own compiler's output on every test
  program costs nothing and is the cheapest assurance in the suite.
* *Golden output.* The SM text emitted for those same snippets, checked in. We
  own both sides here, so pinning the exact output is legitimate and catches
  unintended changes; it is exactly what we must *not* ask of a student.
* *The course's own programs, end to end.* `Seven`, `ConvertToBin`, `Average`,
  `ComplexArrays`, `Square`, `Pong`. Two of them are mechanically checkable as
  they stand — `ConvertToBin` is defined by `RAM[8000]` in and `RAM[8001..8016]`
  out, and `ComplexArrays` prints expected beside actual, so the text buffer can
  be asserted. The graphical ones become a screen-buffer hash plus "runs N
  thousand steps without faulting".
* *The OS, against the course's own OS tests.* Project 12 supplies a test
  program per class, and `MathTest`, `MemoryTest` and `ArrayTest` come with real
  `.cmp` files we can reuse directly. The rest are observational and become
  screen-buffer assertions. This is how the SM library in M7 gets checked, and
  it is a ready-made suite we would otherwise have had to invent.
* *Differential testing,* once M9 exists: compile the same Jack source with our
  compiler and with the course's, run both, compare observable behaviour. The
  strongest test of the lot, and the reason M9 earns its place even though no
  student needs it.
* *Pong as the integration test,* for the same reason the course uses it: it
  exercises objects, statics, arrays, strings, screen and keyboard at once.

*Done when:* every layer above passes, and the course's project 11 programs
behave in the SM emulator as their VM versions do.

### M8 — `projects/11-sm`, the second assignment *(medium)*

The package for the Jack → SM compiler. Unlike M6 it carries **no `.cmp` files**,
because the course's project 11 carries none: the student is told to run the
compiled program in the emulator and look at it — "make sure that it displays 7
correctly", "play the game", "make sure that the actual results are identical to
the expected results". That is a deliberate choice and a correct one. A
compiler has no single right output — label names, evaluation order and
temporaries are all free — so there is nothing to compare a student's output
against, and the course does not pretend otherwise.

So this package is the course's project 11 with the target changed: the same six
programs, staged the same way — `Seven`, then `ConvertToBin`, then `Square`,
`Average`, `ComplexArrays`, `Pong` — each with the same description of what the
student should see, and each runnable in the SM emulator instead of the VM
emulator. The work is in the porting and the instructions, not in inventing a
grading regime.

Two small places where the SM emulator can do better than the course without
changing the character of the assignment, both optional extras rather than the
means of grading: `ConvertToBin` is already defined by a RAM precondition and a
RAM postcondition, so it can be offered with a `.tst` that sets `RAM[8000]` and
checks `RAM[8001..8016]`; and any program can be re-run with the emulator's
screen buffer compared against a recorded one, which turns "it looks right" into
something a student can check twice.

**Project 10 needs no counterpart.** The syntax analyser is a Jack-to-XML
program with no target machine in it; the course's project 10, its
`TextComparer` and its supplied `.xml` compare files carry over to the SM track
unchanged. The SM assignment begins at code generation.

*Done when:* all six programs are present, each runs in the SM emulator when
compiled by the reference compiler, and each carries instructions a student can
follow without the course's VM emulator at hand.

### M9 — `sm-to-vm` and `vm-to-sm` *(large)*

Not an assignment: a bridge, so a program can cross between the two tracks and
each machine can check the other. The two directions are not symmetric, and the
asymmetries are the interesting part.

**SM → VM.** Needs a function table, hence two passes: the course VM writes the
argument count at the *call* site, where SM does not have it.

Globals do **not** map to the `static` segment. They cannot: `static i` in one
`.vm` file is a different cell from `static i` in another, so the VM has no
shared-global storage, whatever the globals are named. Each SM global gets a
fixed address instead, reached through `pointer`/`that` — uniform for every
global, needing no naming convention, and faithful, since the course's own
statics are cells at fixed addresses in `RAM[16..255]` too (Q7).

`[]` becomes `pop pointer 1; push that 0`; `->[]`, with the address below the
value, becomes `pop temp 0; pop pointer 1; push temp 0; pop that 0`.

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

### M10 — Polish *(small)*

Save and share a program by URL. Export a session as a downloadable folder.
Import a course `.vm` directory and see it as SM, and the reverse — the most
direct way to show a student that the two machines are the same machine. A
difference table between SM and the course VM. Continuous integration running
every `.tst` on every push.

## 5. Order of work

There is one critical path and it runs through both assignments:

```
M0 → M1 → M2 → M3 → M4 → M6        first assignment ready, both parts
                  ↘  M7 → M8       second assignment ready
```

M5, the site, proceeds alongside M2–M4 and is needed before either package is
usable. M7 depends on M2 (for the devices) and on M3 (for the test runner), not
on M4 or M6, so the Jack half can start as soon as the emulator runs. M9 depends
only on M1–M3 and is independent of everything else; it is the one large piece
that can be dropped from a first release without costing a student anything.

Two releases suggest themselves:

* **First:** M0–M6 plus the Reference and Rationale pages. The replacement for
  projects 7 and 8 is complete and can be taught on its own.
* **Second:** M7–M8. The Jack assignment, which is what makes the SM track a
  replacement for the course's whole back end rather than for one project.

M9 and M10 follow at leisure.

## 6. Risks

* **`.cmp` files that do not hold.** Both parts of the first assignment rest on
  the SM emulator and the student's assembly output agreeing cell for cell. M3's acceptance
  criterion is written to force that agreement early, before a dozen tests have
  been authored against a wrong assumption.
* **Boolean conventions.** The most-significant-bit convention is the sharpest
  break from the course VM, and the place where a translator silently produces
  wrong answers rather than failing. It needs tests of its own, not just
  coverage inside larger programs.
* **The Jack library absorbing M7.** `Screen` and `Output` can take unbounded
  time. The mitigation is not to cut them — the second assignment needs them —
  but to order M7 so that `Math`, `Memory`, `Array` and `String` land first:
  those alone let the early stages of M8 run, and the graphical stages can wait.
  What can be cut from a release, if something must be, is M9.
* **A quiet bug in our own compiler.** The student package cannot catch it —
  project 11 is graded by eye, by design — so the reference compiler is only as
  good as the suite described in M7. The layer that matters most there is the
  per-construct one: whole programs like `Pong` fail loudly on a broken
  constructor and silently on a wrong evaluation order.
* **Prose drifting from code again.** Mitigated by making the reference page a
  rendering of the normative spec, with its examples executed by the emulator at
  build time.

## 7. Questions for the author

1. Q5 and Q9 in `spec/INVENTORY.md`, both about rules and diagnostics rather
   than generated code.
2. ~~Which translators does the student write?~~ **Answered:** the SM → assembly
   translator, and afterwards the Jack → SM compiler. The SM ↔ VM translators
   are ours.
3. ~~A counterpart to project 10, the syntax analyser?~~ **Answered:** no. The
   analyser has no target machine in it, so the course's own project 10 carries
   over unchanged, `TextComparer` and `.xml` compare files included. The SM
   assignment starts at code generation.
4. Should the site host the course's own VM emulator as well, so a student can
   compare the two machines side by side, or only link to it?
5. Language of the site: English throughout, or English reference with a Hebrew
   rationale?
