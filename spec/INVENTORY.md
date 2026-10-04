# Inventory of the supplied material, and the open specification questions

This file records what was handed over, what the three existing implementations
actually do, and every point on which they disagree with each other or with the
prose documentation. Every item marked **Q** is a decision that has to be taken
before M0 of [`../PLAN.md`](../PLAN.md); the "proposed" line is a
recommendation, not a decision. Decisions are recorded in
[`CORRECTIONS.md`](CORRECTIONS.md).

## 1. What was supplied

Kept verbatim under [`../reference/`](../reference/).

| Area | Files | State |
|---|---|---|
| Language reference | `SM_doc_details_tex.tex` / `.pdf`, `SM_doc_details.txt` | Prose spec; the two differ slightly |
| Implementation notes | `SM_doc_implimintation.txt` | Hand-written Hack-assembly fragment per SM command |
| SM → Hack assembly | `SM_trnsleitor3.py` (+ `2`, and two backups) | Works; depends on an `asembly_OO` module that was **not** supplied |
| Jack → SM | `jack_compaler.py`, `parser.py`, `tokenazr.py` | Covers the full Jack grammar; emits SM |
| Earlier design drafts | `VM1_doc.txt`, `VM1_par_doc.txt`, `VM1_no_par_doc.txt`, `VM1_par_doc_re.txt`, `VM1_doc_details.txt` | Numeric-address predecessors of SM; historical |
| Sample programs | `FibonacciElement_sm/`, `FibonacciSeries_sm/`, `fibonachie/`, `tst/test1/all_cmds.sm` | See §4 |

Two things the material does **not** contain and that we must supply: the Hack
assembler module `asembly_OO`, and any SM emulator at all.

## 2. The machine as the reference implementation actually builds it

Read off `SM_trnsleitor3.py`, which is the only executable statement of the
semantics. This section describes the **reference** behaviour; where we
deliberately depart from it, [`CORRECTIONS.md`](CORRECTIONS.md) says so and
wins. Otherwise this is what the new emulator has to reproduce, because the
`.cmp` files of the student package must match what the student's own translator
produces.

**Stack pointer.** `SP` holds the address of the **top element**, not of the
first free cell. Push is `@SP / AM=M+1 / M=D` — increment, then write. The
bootstrap sets `SP = 256`, so an empty stack is `SP = 256` and the first element
pushed lands at `RAM[257]`; cell 256 is never used. **Changed by C2:** the
bootstrap sets `SP = 255` instead, so the first element lands at `RAM[256]`.
Either way `SP` addresses the top element, not the first free cell, which is
where the course's VM differs and why every expected `RAM[0]` value differs
from the course's by one.

**Call frame.** A call pushes the caller's `LCL`, then the return address, then
jumps. The callee's declaration sets `LCL = SP - (a+1)`, where `a` is its own
argument count, and then pushes `l` zeros for its internal variables. So within
a function of signature `! f(x_0..x_{a-1}) y_0..y_{l-1}`:

| slot | address |
|---|---|
| argument `i` | `LCL + i` |
| caller's `LCL` | `LCL + a` |
| return address | `LCL + a + 1` |
| internal variable `j` | `LCL + a + 2 + j` |

**Consequence worth keeping.** The argument count is needed only by the callee
(at its declaration and at its `<--`), never by the caller. An SM → assembly
translator therefore needs **no function table and no second pass** — which is
exactly what makes this a good first translator for a student. An SM → VM
translator does need one, because the course VM writes the count at the call
site; see §5 of `../PLAN.md`.

**Return.** `<--` saves the top of the stack, sets `SP = LCL - 1`, restores
`LCL` from `RAM[LCL+a]`, pushes the saved value — which lands exactly on the
first argument slot — and jumps to `RAM[old LCL + a + 1]`.

**Variables.** A global `x` becomes the assembly symbol `SM.x`. A local becomes
an `LCL`-relative offset resolved at translation time.

**Booleans.** Only the most significant bit carries meaning. `<` is a plain
subtraction, `>` the reverse subtraction, `==` is `v | -v` followed by bitwise
negation. No comparison emits a label or a jump — the point of the convention.
`?-->` tests with `D;JLT`.

**Bootstrap.** `SP = 256` (C2: `255`), then a *call* to `Sys.init` — kept, per
Q3 — then an infinite loop.

**Reserved assembly symbols** the runtime occupies: `SP`, `LCL`, `tmp`, `end`,
and the prefixes `SM.`, `FUNTION.`, `LABEL.`, `call.`.

The prefixes close the name space completely, and it is worth saying so
explicitly since it is a property worth preserving: every symbol derived from
the user's program is prefixed — a global `x` becomes `SM.x`, a label becomes
`LABEL.f.x`, a function becomes `FUNTION.f` — so no SM program can name the
runtime's own cells, whatever it calls its variables. A global named `tmp`
becomes `SM.tmp` and is a different cell from the scratch register `tmp`.
Locals produce no symbol at all, being `LCL`-relative offsets.

## 3. Questions

Decided so far: **Q1** (→ C1), **Q2** (→ C3), **Q6** (→ C4), **Q8** (→ C5), and
**Q3** and **Q4**, both closed by keeping things as they are. Still open:
**Q5**, **Q7**, **Q9**, and the companion to Q3 — whether falling off the end
of a function is an error. A decision that changes something becomes an entry
in
[`CORRECTIONS.md`](CORRECTIONS.md), which is the normative list of our
deviations from `reference/`.

**Q1 — operand order of `->[]`. DECIDED → C1: the code is right, the prose is
wrong.**

The prose says: top is `y`, the element below is `x`, and the effect is
`RAM[y] := x` — the **address on top**. All four artefacts do the opposite:
`SM_doc_implimintation.txt`, `SM_trnsleitor3.py`, the hand-written `fib.sm`
with its own annotations, and every array store emitted by `jack_compaler.py`
push the **address first and the value on top**.

The decision is to keep the implementations and rewrite the sentence. The
replacement text, normative from here on:

> **`[]` — peek.** The top of the stack is an address. The command replaces it
> by the content of that register.
>
> `… addr` → `… RAM[addr]`
>
> **`->[]` — poke.** The top of the stack is a value and the element below it is
> an address. The command removes both and stores the value in that register.
>
> `… addr value` → `…`, with `RAM[addr] := value`

Four reasons it is the better of the two, recorded so the question is not
reopened:

1. *It makes the operand convention uniform.* For `-`, `<` and `>` the
   documentation already treats the deeper operand as the left-hand one: `x-y`,
   `x<y`. The address is the left-hand side of an assignment. Under this
   decision the rule holds for every two-operand command without exception:
   **the deeper operand is the left-hand one.** Under the prose, `->[]` would
   have been the sole command where it is the right-hand one.
2. *It is the order a compiler produces.* A recursive-descent compiler reading
   `let a[i] = e;` from left to right emits the address first. The other order
   would force the right-hand side to be evaluated before the left.
3. *It is cheaper to implement* — which matters, since implementing it is the
   assignment. With the address below, the value is popped into `D` and the
   address is then sitting in the cell `SP` points at, readable with one
   `A=M`. With the address on top it has to be parked in a scratch register
   first: 13 instructions and a scratch register, against 9 and none. This is
   the same awkwardness the course's `pop that 0` has, and avoiding it is part
   of what the design is for.
4. *The sentence is the cheap thing to change.* The other direction would touch
   the hand assembly, the translator, the compiler, two sample programs, and
   then every `.cmp` file derived from them.

The same paragraph of the supplied document also calls subtraction a sum and
calls the unary `~` a two-operand command (§5), which is why this reads as one
hastily written paragraph, copied into the implementation notes, rather than a
design the code drifted from.

**Q2 — equality mnemonic. DECIDED → C3: `==`, and `=` is an error.**

`=` appears only in `SM_doc_details.txt`; the LaTeX document, `all_cmds.sm` and
the translator all write `==`. C3 also records what rejecting it requires: the
parser's catch-all rule currently turns `=`, and every other typo, into a call
to a function that does not exist and thence into a jump to a garbage address,
so call targets have to be resolved against the declarations for the rejection
to mean anything.

**Q3 — `Sys.init`: called or jumped to? DECIDED: a full call.** No entry in
`CORRECTIONS.md` — this is what `reference/` already does, and it stays.

The design letter argued for a bare jump, there being no environment to save,
and a third option existed between them: push the return address but not `LCL`,
dropping exactly the half that is meaningless. The full call wins on the
simplest ground available — *the bootstrap is a call like every other call*,
with no exception to state and none to implement, and the bootstrap is the
first thing a student writes in part II of the assignment. The two cells and
ten instructions it costs are paid once.

It also keeps, for free, the sentence the specification already contains:
*"After its completion, the program will go into infinite loop."* Under the
call, `<--` from `Sys.init` lands on the bootstrap's landing pad and does
exactly that. The bare jump would have left that `<--` jumping to a cell two
below the stack base that nobody ever wrote, and so would have required the
sentence to be rewritten.

**One consequence to settle with it.** The bootstrap pushes `LCL` before
anything has set it, so the value landing in `RAM[256]` is whatever the `LCL`
register holds at reset. Left undefined, that cell is non-deterministic and any
`.cmp` file covering it is unreliable. *Proposed:* the emulator defines
`RAM[0..15]` as zero at reset, after which the bootstrap sets `SP`; `LCL`,
`ARG`, `THIS` and `THAT` are never touched by SM and stay zero. The Hack CPU
emulator must be made to agree, since the two have to match cell for cell.

**Still open, and raised with this question rather than settled by it:** what
happens when a function reaches its last line without a `<--`. The reference
translator emits nothing, so execution runs straight into the next function's
declaration, which sets `LCL` from the current `SP` and pushes that function's
locals — entering it with a frame that has no return address, so its own `<--`
jumps to a garbage address.

Both supplied `Sys.init` files are one step from this. The hand-written one has
a `<--`, but only after an infinite loop, so it is unreachable; the
Jack-generated one has no `<--` at all, because Jack's `Sys.init` body is
`while (true) {}` with no `return`, and is saved only by that loop.

*Proposed:* a diagnostic — control must not be able to fall off the end of a
function. It costs nothing to add: the depth walk of Q9 already computes which
points are reachable, so this is the same traversal asking one more question.
If Q9 is declined, the traversal is still cheap on its own.

**Q4 — discarding a return value. CLOSED: neither language changes.**

No entry in `CORRECTIONS.md`, because nothing is corrected.

*State the two languages separately, since the question touches both.*

**Jack** has `void` subroutines and the `do` statement, unchanged from the
course. **SM** requires every function to return exactly one value, and has no
command that pops one off the stack and throws it away. A Jack `void` function
therefore compiles to an SM function that returns something — the prototype
returns `0` — and each `do` statement leaves that value behind.

**Is that a problem? No.** The discard is expressible in SM as it stands: a pop
to a dedicated global, `-> x`, removes exactly one cell, is always available,
needs no special case for recursion, and clobbers nothing but a cell nobody
reads. It is also exactly what the course does — the course's own compiler
emits `pop temp 0` after a `do`, which is the same move into a cell nobody
reads. The entire cost of SM not having a dedicated command is **five
instructions and one RAM cell**, on statement calls only.

**What is not a route: emitting nothing.** An earlier version of this entry
offered a second option — leave the value, and let the enclosing function's
`<--` sweep it, since the specification says `<--` eliminates "anything that
stacked above them". That is wrong, and the correction is the author's: *a
compiler that leaves a value on the stack after a statement call has a bug*, and
the tests are supposed to catch it. The sentence in the specification describes
what `<--` does with a stack that has gone wrong; it does not license putting
one in that state.

The practical consequence is the reason the bug matters. A loop whose body makes
such a call grows the stack by a cell per iteration. The Hack stack is
`RAM[256..2047]`, 1792 cells, with the heap immediately above it, so the loop
walks into the heap after fewer than two thousand iterations — a second or two
of a game's main loop — and silently corrupts whatever was allocated there.
Nothing before that point looks wrong.

*Catching it is Q9*, which turns the author's point into a check that runs
before the program does.

*Settled, then:* SM gains no discard command, Jack keeps `void`, and where a
compiler puts a value it is throwing away stays what it always was — the
compiler writer's choice, with nothing observable depending on it. What is *not*
a free choice is whether to discard at all.

**Q5 — the name rules are unenforced, and one of them is missing.**

*First, a correction to how this entry used to read.* It claimed a function and
a global variable may not share a name, on the grounds that a bare symbol is a
call. That is wrong: the two are written differently at the point of use —
`<- foo` pushes the global, `foo` calls the function — and they reach the
assembler as `SM.foo` and `FUNTION.foo`. They coexist perfectly well. The same
goes for a label and a variable, which the document already permits, and for a
label and a function.

So the rules themselves are in reasonable shape. The problems are elsewhere.

**One rule is missing.** The document says local names within a function must be
distinct, and that labels within a function must be distinct. It never says that
**function names must be unique across the whole program** — which they must,
since they become a single flat space of `FUNTION.` labels. Two files each
declaring `!f()` produce two definitions of the same assembly label.

**No rule is enforced, and every violation is silent.** This is the real
content of the question, and it is the same defect that C3 ran into from the
other side. Nothing in the pipeline resolves names:

| mistake | what happens today |
|---|---|
| call to a function that does not exist | `@FUNTION.f` is allocated as a variable; jump to a garbage address |
| jump to a label that does not exist | the same, with `@LABEL.f.x` |
| two functions with the same name | two definitions of one assembly label |
| two labels with the same name in one function | the same |
| an argument and an internal variable with the same name | `dict(zip(...))` keeps the last; the argument becomes unreachable |
| a declaration's argument count disagreeing with what callers push | nothing; the frame is simply wrong |

Not one of these produces a message. Every one of them produces a program that
assembles cleanly and then misbehaves far from its cause.

**Where the checks have to live: the emulator — and nowhere near the
assignment.** The obvious home for name resolution is the translator, but the
translator is the student's, and we neither write it nor can rely on it. If the
checks live only there, a student with a malformed `.sm` file cannot tell a bug
in the program from a bug in the translator they are in the middle of writing,
which is the worst possible confusion to hand someone at that moment. So the
emulator carries the full set, and a program it rejects is known to be bad
before any translator touches it.

The converse matters just as much: **the student's translator is never required
to perform any of these checks**, and no test in `projects/07-sm` may expect a
diagnostic from it. The course assumes error-free input throughout — its
project 11 page says outright that the supplied programs are error-free, so a
failure means a bug in the student's program and not in the test — and we assume
the same. Validation is a service our tools provide, not a requirement we
impose.

*Proposed:* add the missing rule; state all of them in one place in the
reference; implement the whole table above as diagnostics in the emulator, with
`sm-core` exposing them so our own tools get them too.

**Q6 — the mnemonics. DECIDED → C4: the mnemonics are the language; the words
are a view.** The emulator renders any program word-for-word so the two can be
compared by eye, but only the structural commands have a word form — the
arithmetic and logical operators stay symbolic everywhere.

**Q7 — statics versus globals by naming convention.** A name containing `.` is
a static of the file named before the dot; a name without a dot is a true
global. This is a convention, not a rule the translator enforces.
*Proposed:* have the tools warn when a file writes to a dotted name belonging to
another file, and leave it legal.

**Q8 — negative literals. DECIDED → C5: follow the course.** `<- n` takes a
non-negative decimal; a negative value is `<- n` then `(-)`; a leading sign is
a syntax error, and so are a bare `<-` and a bare `->`. The course forbids
negative literals at all three of its levels, and the cause is the same one
that binds SM: the Hack A-instruction has fifteen bits and no sign, so a
constant push is a one-to-one translation only while the constant is
non-negative.

**Q9 — should the stack depth be a function of the program point?** *(New,
and mine rather than the author's — it generalises a point of his, and the
generalisation needs his assent.)*

Q4 settles that a compiler leaving a value on the stack after a statement call
has a bug. The question here is whether SM should say so in a form a machine
can check, and the proposed rule is the one bytecode verifiers use:

> At every program point inside a function, the depth of the stack above the
> function's locals is determined by the point itself, and not by the path taken
> to reach it. At `<--`, that depth is exactly one.

Every command has a known effect on depth — `<- …` adds one, `-> …` removes
one, the binary operators remove one, `(-)`, `~` and `[]` leave it, `->[]`
removes two, `?-->` removes one, and a call removes the callee's argument count
and adds one. So the depth at each point can be computed by walking the
function, merging at labels and reporting a disagreement. The only input beyond
the function itself is the arity of each callee, which a whole-program loader
has.

**A worked example.** It is the output of a *hypothetical* compiler that omits
the discard of Q4 — not of the supplied one, which emits `->tmp` after every
`do` statement and is balanced throughout. Correct output would never reach
this check. `Screen.drawPixel(x, y)` is `void` in Jack and takes two arguments;
note that its being `void` is invisible here, since in SM every function
returns a value and the depth arithmetic does not care what Jack called it. The
caller must remove that value, and this one has not:

```
while:
    <- @i          1
    <- @n          2
    <              1
    ~              1
    ?--> end       0
    <- @x          1
    <- @y          2
    Screen.drawPixel   1     ← two arguments off, one value on
    --> while      1         ← reaches the label at depth 1
end:
```

The label is reached twice: by falling in from above at depth 0, and round the
loop at depth 1. They disagree, and that disagreement *is* the missing discard.
A correct compiler emits `-> tmp` before `--> while`, the arrival depth returns
to 0, and the check passes.

**What it buys.** The leak of Q4 is reported *before the program runs*, naming
the function and the point where two paths disagree, instead of appearing as
heap corruption after two thousand iterations of a game loop. It subsumes the
weaker runtime check — bounding `SP` at 2047 — which remains worth having as a
backstop, since runaway recursion is unbounded at run time and no static walk
can catch it.

**Where it lives:** the emulator and `sm-core`, for the reason given in Q5 —
and, equally, not in the assignment. The student's translator is theirs, cannot
be relied on, and is not required to perform the check; a malformed program
should simply be known to be malformed before any translator is blamed for it.

**What the course does: nothing of the kind.** Worth knowing, because adopting
this makes the SM track stricter than the book.

* The course's VM has the same hazard. `call f n` always leaves a return value,
  so a Jack `do` statement leaves one, and the course's own compiler removes it
  with `pop temp 0` — the same move the SM prototype makes.
* The course's `return` is equally forgiving. It ends with `SP = ARG+1`,
  discarding whatever was left above the frame, exactly as `<--` does.
* The VM language imposes no requirement on stack depth, and the course
  supplies no verifier. A VM program whose depth at a label depends on the path
  is legal and runs.

So this is a deviation. Two readings:

*Against.* A rule that is not in the book is a rule a student has to learn from
us, and the book is the thing they are reading.

*For.* The course's permissiveness here is the absence of a tool rather than a
decision, and SM would be joining the norm rather than leaving it: the JVM's
and the CLR's verifiers both check exactly this, and WebAssembly makes it
unrepresentable by replacing labels with structured control flow.

**It is not a defect report on the supplied compiler.** `jack_compaler.py`
already keeps this discipline. The check exists because the second assignment
hands that discipline to every student, and because a discipline nothing
verifies is one that decays — as the XML parser in the same directory shows,
having rotted to `"fild"` while the compiler beside it stayed correct.

**What it costs in practice: close to nothing.** Ask who could ever be
inconvenienced. In both parts of the first assignment the `.sm` files are ours,
so the rule never fires. In the second assignment the SM is the output of the
student's compiler, so it fires exactly when that compiler has the bug — which
is the signal they need, delivered at the only moment it helps. Only someone
hand-writing SM could be stopped by it, and only by writing a program that
wants a path-dependent depth. Nothing in `reference/` does.

*Proposed:* adopt it as an error, with the runtime bound kept as the backstop.
The weaker form — report it as a warning, narrowing nothing — is available, but
it buys little: the one population the rule ever reaches is students whose
compiler is wrong, and a warning is what they would ignore.

## 4. Errors in the supplied samples

* `FibonacciElement_sm/Sys.sm` pushes `6` under a comment that says "the 4'th
  fibonacci element", while `FibonacciElement.cmp` is the stock course file for
  `n = 4`. The three disagree.
* `FibonacciElement.cmp` expects `RAM[0] = 262`, which assumes the course's
  stack-pointer convention, not SM's (§2). Both `.tst` files are the course's
  originals with the `.vm` names swapped and will not run against SM.
* `FibonacciElementVME.tst` calls `vmstep`, a command of the course's VM
  emulator, which has no SM counterpart yet.
* Everything in `projects/07-sm/` must therefore be written from scratch and its
  `.cmp` files generated by the reference translator, never copied.

## 5. Prose corrections to carry into the new reference page

* `-` is described as replacing the operands "by there sum" — it is the
  difference.
* `~` is described as acting on "the top 2 elements" — it is unary.
* `(-)` is arithmetic negation, `~` is bitwise negation; the current text does
  not separate them, and the difference matters because `~` is what implements
  logical NOT under the most-significant-bit convention.
* The document never states where `SP` points, which is the one fact a student
  writing a translator needs first.
* The convention settled by Q1 should be stated once, as a rule, rather than
  re-derived per command: **in every two-operand command the deeper operand is
  the left-hand one** — `x` in `x-y`, `x<y`, `x>y`, and the address in
  `RAM[addr] := value`.
* The function-declaration section should state that the argument count is a
  property of the callee alone.
