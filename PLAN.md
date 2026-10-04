# Work plan

An online replacement for the virtual-machine part of nand2tetris, built around
the SM stack machine.

Companion document: [`spec/INVENTORY.md`](spec/INVENTORY.md) — what the supplied
material contains, how the existing Python translator actually behaves, and the
nine specification questions **Q1**–**Q9**, all of them now answered. The seven
answers that changed something are [`spec/CORRECTIONS.md`](spec/CORRECTIONS.md),
**C1**–**C7**. This plan refers to both by number.

---

## 1. What we are building

| # | Deliverable | Form |
|---|---|---|
| 1 | SM emulator | In-browser, no server |
| 2 | SM → VM and VM → SM translators | In-browser, plus a command-line entry point |
| 3 | Jack → SM compiler | In-browser, plus a command-line entry point |
| 4 | The site | Home page, tabs, and two language trees with Hebrew the default |
| 5 | SM reference page and rationale page | Pages within it |
| 6 | `projects/07-sm/` | First assignment, part I: a directory of tests the student downloads |
| 7 | `projects/08-sm/` | First assignment, part II |
| 8 | `projects/11-sm/` | Second assignment |

Everything runs client-side. The site is a static bundle on GitHub Pages; there
is no backend, no account, and no upload. A student can also clone the
repository and run every tool from the command line, which is what continuous
integration does.

**The course's own tools are linked, not hosted** — its web IDE at
`nand2tetris.github.io/web-ide/` and its download page. We ship nothing of
theirs. This costs the site a side-by-side comparison of the two machines, and
M10's import and export of `.vm` directories is what replaces it: a student
moves the program rather than running both at once.

It costs our *testing* nothing, which is worth stating because it looks as
though it might. The course's desktop tools run headless — verified here on the
compiler, the assembler, the CPU emulator and the VM emulator — so continuous
integration can reach them without their appearing on the site. §4 says exactly
how far each of them can be trusted, which is further for some than for
others.

**Two of these are assignments; the rest is scaffolding.** The student writes
exactly two programs: an **SM → Hack-assembly translator**, replacing projects
7–8, and then a **Jack → SM compiler**, replacing project 11. Deliverables
(6)–(7) are the first assignment, split into two parts as the course splits it,
and (8) is the second. The SM ↔ VM translators are never assigned —
they exist so that a program can cross between the SM track and the course's own
track, and so that each machine can be used to check the other.

That second assignment is what makes the Jack half of the project mandatory
rather than optional, and it pulls one thing onto the critical path that would
otherwise have been polish: **the Jack operating system, compiled to SM**. A
student's own compiler emits calls to `Math.multiply`, `String.new`,
`Output.printString`; the course supplies the library as `.vm` files, so we must
supply it as `.sm` files, and the emulator must own a screen buffer and a
keyboard register for it to drive. Deliverable (8) cannot exist without that
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
  sources, the emulator, and whatever that assignment is graded by — `.tst` and
  `.cmp` files for the first, a description of what to look for in the second,
  which is how the course grades each of them. Our own SM → assembly translator
  is a build tool for generating those `.cmp` files, and is not shipped.
  The Jack → SM compiler is different: the course ships a reference compiler
  alongside project 11 precisely so a student can compare, and we do the same.
* **Round trips prove the tracks are one machine.** SM → VM → SM and
  VM → SM → VM over the course's own project 7/8 programs, compared by what the
  programs do rather than by text, is what shows the SM track to be a genuine
  alternative and not a fork. As a *test* it is broad and blunt — §4 — so it
  demonstrates the claim rather than carrying the suite.
* **Validating the input is our job, not the student's.** Our tools — the
  emulator, `sm-core`, our own translator and compiler — check that an `.sm`
  program is well formed and say precisely what is wrong with it when it is not.
  The student's translator is never required to do any of that, exactly as the
  course never requires it: its test programs are error-free by construction and
  a translator may assume so. The consequence is a rule for M6, written out
  there: no test in the student package feeds a malformed program and expects a
  diagnostic.
* **A milestone is not finished until its tests are.** The tests for a piece of
  work are written with that work, not after it and not in a later milestone,
  and they run automatically. A milestone whose code is complete and whose
  tests are not is not complete. §4 says what this means in practice.
* **Nothing that once passed is allowed to start failing.** Every test any
  milestone adds stays in the regression suite for good, and the whole suite
  runs at every milestone boundary and on every push. §4 again.
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
web/             the site
projects/07-sm/  first assignment, part I: commands without frames
projects/08-sm/  first assignment, part II: control flow, functions, bootstrap
projects/11-sm/  second assignment: the Jack to SM compiler
reference/       the supplied material, verbatim and never edited
oracle/          the same programs, repaired — what our ports are compared against
tools/           .cmp generation, the wrapper round the course's tools, CI scripts
```

**We do not reimplement the Hack assembler or the CPU emulator.** They exist,
they work, and the student has them already. Where a `.asm` has to be
assembled and run — generating a `.cmp`, checking our translator against the
emulator — `tools/` calls the course's own, pinned and invoked headless. None
of this reaches the site, which runs SM and nothing else.

## 4. Testing and regression

Two rules, and then what they amount to.

**Every milestone ships its own tests.** They are written alongside the code,
they run without anyone remembering to run them, and the milestone's *Done
when* is not met until they are green. A milestone that lands code without
tests has not landed.

**Every test ever written keeps running.** The regression suite is cumulative:
nothing leaves it because it is old or slow or belongs to a part of the system
nobody is touching this week. It runs at every milestone boundary and on every
push, and a failure in it blocks the work in hand regardless of whether that
work seems related.

### What each milestone contributes to the suite

| milestone | what it adds, and what then runs forever |
|---|---|
| M1 `sm-core` | every sample in `reference/` parses; the pretty-printer round-trips each one |
| M2 `sm-emulator` | step-by-step RAM agreement between the emulator and the assembled output of `sm-to-asm`; the runtime stack bound fires where it should |
| M3 `sm-tst` | one `.cmp` satisfied both by `smstep` over the `.sm` in our runner and by `ticktock` over the `.asm` in the course's emulator |
| M4 `sm-to-asm` | golden output for every sample, differing from `oracle/`'s translator only at the points `spec/CORRECTIONS.md` names |
| M5 the site | the build succeeds; both language trees carry the same pages and headings; a smoke test that the emulator page runs `FibonacciElement` from a cold load |
| M6 the first assignment | every test in both packages passes both ways; a deliberately broken translator fails at least one |
| M7 `jack-to-sm` | the parser against the course's project 10 `.xml` files via its `TextComparer`; then the layered suite the milestone describes, plus the depth-walk lint over our own generated SM |
| M8 the second assignment | all six programs compile and run |
| M9 the bridge | the round trips, by emulator output rather than by text |
| M10 | the whole of the above, on every push, as the standing job |

### What the suite is measured against

**The supplied implementations, as a corrected working copy.**
`SM_trnsleitor3.py` and `jack_compaler.py` are what our ports must reproduce;
they are the reference for this project in a way the course's tools are not.
But they contain defects — three are already known
(`spec/INVENTORY.md` §4a) — so reproducing them faithfully would mean
reproducing those too.

So there are two copies, and the distinction is the whole practice:

* `reference/` is **frozen**. It is the historical record of what was handed
  over and is never edited, so that any claim about the original can be
  checked against it.
* `oracle/` is the **working copy**: the same programs, repaired. Every repair
  is a commit that says what the defect was and why the new behaviour is
  right. Our ports are compared against this copy, never against `reference/`.

The set of commits to `oracle/` is then a second record alongside
`spec/CORRECTIONS.md` — that one says where we depart from the *documentation*,
this one says where we depart from the *code*.

Three repairs are already identified. Two are needed merely to run the
programs at all, and neither is real work: `jack_compaler.py` calls
`compale_folder` at import time with a hard-coded Windows path, and
`SM_trnsleitor3.py` imports an `asembly_OO` module that was never supplied —
which matters less than it looks, since that module is used only by
`add_numbrs`, a step that runs *after* translation is complete and exists only
to annotate each SM line with the Hack instruction number it produced. The
repair is to make that step optional, not to write an assembler.

The third is behavioural — the `<-@this`
defect — and it needs a decision of its own, because the Jack source of the
sample is at fault too: repairing the sample to call `Main.fibonachie(...)`
makes both compilers agree, while making the compiler *reject* the unqualified
call, as the official one does, is a separate repair and the one our own
compiler will carry.

**The course's tools are a reference too, used with more care — not an
oracle.** They run headless, verified here on the compiler, the assembler, the
CPU emulator and the VM emulator, so continuous integration can reach them.
But they mostly do a *different job* from ours, and only one of them yields a
direct comparison at all:

| their tool | how we use it |
|---|---|
| Assembler, CPU emulator | **not compared — used.** We build no counterpart, so there is nothing to check them against |
| Jack compiler, project 10 XML | **direct comparison**: same `.jack` in, same XML out, against their `.cmp` files with their `TextComparer` |
| Jack compiler, code generation | **behavioural only** — theirs emits VM, ours SM; compile both, run each on its own machine, compare what is observable |
| VM emulator | **behavioural only**, and through our own bridge |

The one direct row is worth a great deal. The two behavioural ones are worth
less than they look: a mismatch there has three suspects — our tool, their
tool, and the translation between — and nothing in the failure says which.

**The reference can be wrong, and is certainly incomplete.** Incomplete first:
there is no reference anything for SM, their `.cmp` files cover only their own
programs, and project 11 ships none at all. Wrong second, demonstrably — their
return analysis accepts `while (false) { return 1; }`, which plainly falls off
the end. C6 adopts that unsoundness deliberately, which is the point: a
divergence from the reference is a decision to be taken and written down, not
an exception quietly added to a comparison script.

**They cannot be given the same treatment**, which is worth noting rather than
discovering later: they ship as compiled jars with no source, so there is no
copy to repair. What we can do instead is pin the version, capture their
behaviour once into expectation files we keep, and compare against those —
correcting an expectation, when it proves wrong, in a commit that says why.

**Every defect found gets a test before it is fixed.** The suite grows by one
case per bug, which is what keeps a fix from being undone six months later by
someone who does not know why the code looked strange. Three cases already
exist to be written, from the defects in `spec/INVENTORY.md` §4a: the
unqualified call that pushes an argument the function does not have, the XML
parser that tests for `"fild"`, and the checked-in `.sm` that no longer matches
its compiler.

**Two tiers, so that the suite is actually run.** A fast tier — parsing, golden
files, unit tests, the lint — on every commit, in seconds. A slow tier — whole
programs, the Java tools, `Pong` — on every push and at every milestone
boundary. A suite nobody waits for is a suite nobody runs, and then it is not a
regression suite at all.

## 5. Milestones

Each milestone ends in something runnable. The estimates are relative sizes, not
calendar time.

### M0 — Write the specification *(small)*

The deciding is done. Every question is answered and `spec/INVENTORY.md` §3
records each with its reasoning; seven answers changed something and are
`spec/CORRECTIONS.md`, the normative list of our deviations from `reference/`:

| | |
|---|---|
| **C1** | `->[]` follows the implementations — address below, value on top — and the prose is corrected to match |
| **C2** | the bootstrap sets `SP = 255`, so the stack starts at `RAM[256]` |
| **C3** | the equality mnemonic is `==` and `=` is an error, which requires that every called name resolve to a declared function — without that, the parser's catch-all rule turns any typo into a jump to a garbage address |
| **C4** | the mnemonics are the language; the word forms are a rendering, with the arithmetic and logical operators symbolic in every view |
| **C5** | constants are non-negative as in the course, negation is `(-)`, and an empty operand is an error rather than something the catch-all rule swallows |
| **C6** | the course's two missing-return checks — static in our Jack compiler, dynamic in our emulator — with its flow analysis written out in full |
| **C7** | function names are global and must be distinct, a rule the document lacked, with five name-resolution diagnostics: the three the course performs, a label declared twice in one function, which it does not, and a reference to an undeclared local, which SM catches statically where the course's numbered locals force a runtime fault |

Four questions closed with no entry, all by keeping things as they are:
**Q3**, the bootstrap performs a full call to `Sys.init` rather than a jump;
**Q4**, neither language gains a discard, where a compiler puts a thrown-away
value staying its own business; **Q7**, SM has one flat space of globals and
the dotted naming is a Jack artefact; and **Q9**, a program that grows the
stack in a loop is legal SM, the emulator bounding the stack at run time
rather than refusing the program.

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

An interpreter over a 32K 16-bit RAM image laid out as `spec/INVENTORY.md` §2
describes it and `spec/CORRECTIONS.md` amends it, so that a RAM dump from the
SM emulator
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
and every `.cmp` covering that cell is unreliable. Nothing of ours has to
agree with that, since the Hack side *is* the course's own emulator.

**Bound the stack at run time, and only at run time.** `SP` passing 2047 is an
overflow into the heap, and the emulator stops the program and names the
function, as the course's does — measured: `Stack overflow in Sys.init.1`. A
program that grows the stack in a loop is legal SM, exactly as it is legal VM
(Q9 declined), so the emulator reports the fault where it happens rather than
refusing the program.

*Done when:* `FibonacciElement` in SM computes the right value, and the RAM
image after each step matches the one the course's CPU emulator reaches on the
assembled output of `sm-to-asm`.

### M3 — `sm-tst` *(small)*

The `.tst` scripting language of the course, as far as our tools need it:
`load`, `output-file`, `compare-to`, `output-list RAM[i]%D1.6.1`, `set`,
`repeat { }`, `output`, and a `smstep` command standing where the course's
`vmstep` stands. The same runner drives the browser and the command line.

A `.tst` that names a `.asm` is not ours to run: `tools/` hands it to the
course's CPU emulator, which is also what the student will use. So this
milestone is one runner for SM and a wrapper, not two emulators.

*Done when:* one `.cmp` file is satisfied both by `smstep` over the `.sm`
sources, in our runner, and by `ticktock` over the assembled output of
`sm-to-asm`, in theirs. That equivalence across the two tools is the whole
premise of the student packages, and proving it early is why this milestone
comes before any test is written.

### M4 — `sm-to-asm`, the reference translator *(medium)*

A clean port of `SM_trnsleitor3.py`. It stays out of the shipped site; its job
is to generate `.cmp` files and to be the thing a student's translator is
measured against.

*Done when:* its output agrees with `oracle/`'s copy of the Python translator
on every sample, except at the points listed in `spec/CORRECTIONS.md` — which,
for this milestone, means C2 and nothing else. Against `reference/`'s frozen
copy it will differ further, by whatever `oracle/` has repaired; that is the
point of the two copies and not a discrepancy to explain away.

### M5 — The site, first cut *(medium)*

**The shell comes first, because everything else is a page inside it.**

*A home page* that gathers every page, with a line on each saying what it is
for, so the site has a front door rather than a bookmark per tool.

*A tab bar on every page*, the same tabs in the same order everywhere, marking
the current one: Emulator, Reference, Rationale, Projects, and later
Translators and Jack. Moving between pages is one click from anywhere.

*Two languages, Hebrew by default.* Both flags with their language names sit at
the top of every page. Hebrew is served at `/`, English at `/en/`, the same
tree under each, and switching keeps the page you are on rather than returning
you to the front door.

Three consequences of the bilingual decision, all of them cheap now and
expensive later:

* **Direction.** Hebrew pages are right-to-left, and anything that is code is
  not. A `.sm` listing, a RAM dump, a stack view, a `.tst` script and an error
  message must each be marked left-to-right explicitly, or the browser reorders
  them — a leading `@` jumps to the far end, a `->` points the wrong way. This
  has to be in the page components from the first one, not retrofitted.
* **What is not translated.** The mnemonics, the code, the file names, the
  `.tst` syntax, and the diagnostics. The messages are the course's own wording,
  adopted verbatim by C6 and C7, and translating them would break the match
  that is their point; a Hebrew page may gloss one, but the message itself
  stays as it is.
* **Keeping the two in step.** Two prose trees drift apart. The build checks
  that every page exists in both languages and that their section headings
  correspond; a page that has not been translated yet is served in the other
  language behind a visible banner, never as a missing page.

**Then the pages.** The emulator page loads a folder of `.sm` files, runs them,
shows the stack, the frame chain, the globals and raw RAM, and highlights the
current line.

* **Reference** is `spec/sm.md`, rendered, with a live "try it" box per command.
* **Rationale** follows the design letter: a virtual machine should be generic
  rather than shaped by one language's implementation; the stack should carry
  *all* computation, pointers included, which is what `[]` and `->[]` buy and
  what removes the `pointer`/`this`/`that` segments; symbolic variables rather
  than numeric addresses, since the language is textual anyway; a single frame
  pointer, since the offset between arguments and locals is known at translation
  time; globals as one flat space rather than two segments; and a boolean
  convention that makes `<`, `>`, `==` branch-free.
  It should state the costs honestly too — re-deriving `this` on every field
  access is slower than the course's constant `this`, offset partly by cheaper
  calls — and it is the page where the mnemonics are argued, C4 having settled
  that the emulator renders both notations so the reader can judge.
* **Links, not copies**, to the course's own tools: its web IDE and its
  download page.

*Done when:* the home page, the tab bar and the language switch work; the three
pages are live on GitHub Pages in both languages; and the emulator runs
`FibonacciElement` from a cold load, with its code pane reading correctly on
the Hebrew side.

### M6 — `projects/07-sm` and `projects/08-sm`, the first assignment *(medium)*

Two packages, as the course has two projects. The split is what makes the
assignment tractable: part I is the commands that need no frame, part II is
frames, control flow and the bootstrap, which is the hard half.

**Every program in both packages is valid SM, and nothing here grades error
handling.** The validation we build — resolved call targets (C3), the name
rules and their five diagnostics (C7), the missing-return checks (C6) — belongs
to our tools and exists so that a student can tell a bad `.sm` file from a bug
in the translator they are writing. It is not part of the assignment, and a test that fed a malformed
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

**The front end is plumbing, not a topic.** The Jack grammar is the course's,
unchanged — SM changes the target, not the language — so there is nothing to
design and nothing here concerns the student, project 10 having carried over
intact. It is written because the compiler needs a tree to walk.

Two things it must have that the prototype's does not: **one** parser rather
than two, and **source positions** on every node. The prototype parses Jack
twice, once in `parser.py` to emit XML and again inside `jack_compaler.py` to
emit SM, so the grammar is implemented twice and the two have already drifted
apart — `parser.py` tests for `"fild"` where the compiler correctly tests for
`"field"`, and has therefore not parsed a class with fields for some time. With
no tree between parsing and emitting there is also nowhere to hang a position,
which is why no message from any later stage can name a line.

Testing it is nearly free, and that is the point of the grammar being the
course's: our parser emits the project 10 XML and is compared against the
course's own `.xml` files with its `TextComparer`. Three test sets, seven class
files, of known-good expected output that we did not have to write. Note that the prototype would
not pass them as it stands — it labels its tokens `integrConstant` and
`StringConstant` where the course expects `integerConstant` and
`stringConstant`.

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
* *Stack discipline, as a lint on our own output.* Walk each generated
  function and compute the depth of the stack above its locals at every point:
  paths meeting at a label must agree, and `<--` must find exactly one value.
  This catches a statement call whose result is left behind, which no other
  layer sees until a loop has run long enough to walk into the heap, and it
  found the real defect in the supplied prototype (`spec/INVENTORY.md` §4a).
  It is a continuous-integration check over the SM *we* generate and nothing
  more — Q9 declined it as a rule of the language, so the emulator neither
  performs it nor knows of it. Approved on that basis, and it lives in
  `tools/`, never in `sm-core` beside the real diagnostics, so that nobody
  later wires it into the emulator and narrows the language by the back door.

  One tension to remember rather than solve now. Leaving a statement call's
  value on the stack in *straight-line* code is legal and costs nothing, `<--`
  sweeping it, so we may one day want our compiler to do exactly that and save
  five instructions per call. The lint's "exactly one value at `<--`" clause
  would forbid our own legal optimisation. If we ever take it, that clause is
  what relaxes — and the arity mistake it was catching is then caught instead
  by C7's check that `<- @x` names a declared local, which is where the
  prototype's defect really belongs.
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
  compiler and with the course's, run each on its own machine, compare what is
  observable. Broad but blunt — a mismatch implicates our compiler, their
  compiler or the bridge, and says nothing about which — so it is a net for
  what the layers above missed, not a substitute for them. It needs nothing
  hosted: both of their tools run headless.
* *Pong as the integration test,* for the same reason the course uses it: it
  exercises objects, statics, arrays, strings, screen and keyboard at once.

*Done when:* every layer above passes, and the course's project 11 programs
behave in the SM emulator as their VM versions do.

### M8 — `projects/11-sm`, the second assignment *(medium)*

The package for the Jack → SM compiler. Unlike M6, **nothing in it is graded by
a `.cmp` file**, because nothing in the course's project 11 is: the student is told to run the
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
and VM → SM → VM both preserve what the program does — the SM side measured in
our emulator, the VM side in the course's.

### M10 — Polish *(small)*

Save and share a program by URL. Export a session as a downloadable folder.
Import a course `.vm` directory and see it as SM, and export SM as `.vm` for
the course's own emulator — with that emulator linked rather than hosted, this
is how a student sees that the two machines are the same machine, and it is the
reason M9 earns a place on the site and not only in the test suite. A
difference table between SM and the course VM. Continuous integration running
every `.tst` on every push.

## 6. Order of work

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

## 7. Risks

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
* **A regression suite that decays.** The usual failure is not that tests are
  never written but that a slow one gets skipped, then quarantined, then
  deleted. The two tiers in §4 exist to keep the fast one fast enough that
  nobody is tempted; a test that becomes a nuisance is made quicker or moved
  down a tier, never dropped.

## 8. Questions for the author

1. ~~The specification questions.~~ **All answered**, C1–C7 in
   `spec/CORRECTIONS.md` for the seven that changed something, and Q3, Q4, Q7
   and Q9 closed by keeping things as they are. Nothing is waiting: M0 can be
   written.
2. ~~Which translators does the student write?~~ **Answered:** the SM → assembly
   translator, and afterwards the Jack → SM compiler. The SM ↔ VM translators
   are ours.
3. ~~A counterpart to project 10, the syntax analyser?~~ **Answered:** no. The
   analyser has no target machine in it, so the course's own project 10 carries
   over unchanged, `TextComparer` and `.xml` compare files included. The SM
   assignment starts at code generation.
4. ~~Host the course's VM emulator, or link to it?~~ **Answered:** link only.
5. ~~Language of the site?~~ **Answered:** both, Hebrew by default, English at
   its own address, with both flags and their language names at the top of
   every page. Plus a home page gathering the pages, and tabs on each for
   moving between them.
