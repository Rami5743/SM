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

**Bootstrap.** `SP = 256` (C2: `255`), then a *call* to `Sys.init` (Q3), then an
infinite loop.

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

Decided so far: **Q1** (→ C1), **Q2** (→ C3), **Q6** (→ C4), and **Q4**, closed
with no change to either language. Still open: **Q3**, **Q5**, **Q7**, **Q8**.
A decision that changes something becomes an entry in
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

**Q3 — `Sys.init`: called or jumped to?**

The reference bootstrap is `SP = 256`, then a full call: push `LCL`, push the
return label, jump, and a landing pad followed by an infinite loop. The design
letter objects that there is no environment to save, since no function is
running yet, and proposes a bare jump instead.

**What is actually at stake.** Not cost. The call costs two cells and ten
instructions, once, at startup. It is entirely a question of what happens when
`Sys.init` returns — and the specification says it may: *"After its completion,
the program will go into infinite loop."* Under the call, `<--` from `Sys.init`
lands on the bootstrap's landing pad and does exactly that, for free. Under a
bare jump it does not, and the arithmetic is worth following, because it is the
whole question.

With a bare jump and `SP = 255`, the declaration `!Sys.init()` sets
`LCL = SP - 1 = 254`. The body then runs correctly — locals are pushed and
addressed from `LCL`, and the stack grows from 256 as it should. Only `<--`
breaks: with `a = 0` it reloads `LCL` from `RAM[254]` and jumps to `RAM[255]`,
two cells below the stack base that nobody ever wrote. The program jumps to a
garbage address.

**So there are three options, not two.**

*A — keep the call.* `<--` from `Sys.init` behaves as the specification says.
No special case anywhere: the bootstrap is a call like every other call, which
matters because the bootstrap is the first thing the student implements. The
emulator's frame chain has an ordinary bottom frame instead of one pointing
below the stack base.

*B — bare jump, and `<--` from `Sys.init` becomes a program error.* Saves two
cells and ten instructions. Requires rewriting the specification sentence above,
and requires the emulator to detect and report the return rather than let it
jump. Note that it also puts a burden on the Jack side: `Sys.init` there is an
ordinary `void` function, and nothing stops a student's version from reaching
its end.

*C — push the return address, but not `LCL`.* Saves one cell and five
instructions, and `<--` still works: the frame's return slot is correct, the
saved-`LCL` slot holds garbage that is loaded into `LCL` on the way out and
never read again, because the next thing that happens is the infinite loop.

**Recommendation: C, with A as the safe fallback — not B.**

The letter's argument is that there is *no environment to save*. Taken
literally, that is an argument for C and not for B: the meaningless thing being
pushed is the saved `LCL`, and C drops precisely that. A return address is not
environment — it is where to go — and `Sys.init` genuinely does have somewhere
to go, because the specification promises it an infinite loop to fall into.

Between C and A the margin is one cell, and A has the simpler story to tell a
student: *the bootstrap is a call.* If the reference page would rather not
explain why one half of a frame is pushed and the other is not, A is the honest
choice and costs nothing that matters.

**Also to be settled here, whichever is chosen:** what happens when a function
reaches its last line without a `<--`. The reference translator emits nothing,
so execution runs on into whatever function the translator happened to place
next. The Jack prototype's own `Sys.init` does exactly this — it has no `<--` at
all — and is saved only by its infinite loop. This should be a diagnostic.

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

*The second route, also already available:* emit nothing. `<--` eliminates
"anything that stacked above them", so values left behind are swept when the
enclosing function returns. Correct, zero instructions, and explicitly
permitted — but only outside a loop, for the reason below.

**The one hazard, and it is not a language defect.** A loop whose body makes a
statement call, and whose compiler emits no discard, grows the stack by a cell
per iteration. The Hack stack is `RAM[256..2047]`, 1792 cells, with the heap
immediately above it, so such a loop walks into the heap after fewer than two
thousand iterations — a second or two of a game's main loop — and silently
corrupts whatever was allocated there. A compiler that emits `-> x` never
meets this; a compiler that relies on the sweep inside a loop always does.

*What that calls for is a diagnostic, not a command.* **The emulator must bound
the stack and report an overflow when `SP` passes 2047.** That turns the single
worst failure mode in this area into a message naming its cause, costs nothing,
and is worth having whatever else is decided — it catches runaway recursion
just as well. Our own test suite covers the same ground from the other side:
after a function returns the stack is at its previous depth, and a long-running
loop does not grow it (M7).

*Settled, then:* SM gains no discard command, Jack keeps `void`, and where a
compiler puts a value it is throwing away stays what it always was — the
compiler writer's choice, with nothing observable depending on it.

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

**Where the checks have to live: the emulator.** This is the part worth
deciding deliberately. The obvious home for name resolution is the translator —
but the translator is the student's, and we neither write it nor can rely on it.
If the checks live only there, a student with a malformed `.sm` file cannot tell
a bug in the program from a bug in the translator they are in the middle of
writing, which is the worst possible confusion to hand someone at that moment.
So the emulator carries the full set, and a program that the emulator rejects is
known to be bad before any translator touches it.

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

**Q8 — negative literals.** The parser's pattern for `<- 5` is `[0-9]*`, which
accepts no sign — and also matches a bare `<-`.

**What the course does.** It forbids them, at all three levels, and for a
reason SM inherits exactly.

* *The VM language.* `push constant x` takes "some non-negative integer x".
  There is no negative literal; negative numbers are produced by the `neg`
  command, whose SM counterpart is `(-)`.
* *Jack.* An `integerConstant` is a decimal number in `0..32767`. `-5` is not a
  literal but the unary operator `-` applied to the literal `5`. The SM
  prototype's own Jack compiler already follows this, mapping unary `-` to
  `(-)`.
* *Hack assembly.* `@value` takes a non-negative decimal in `0..32767`, because
  the A-instruction has fifteen bits and no sign. `@-5` cannot be assembled.

The third is the cause of the first two. A VM translator renders
`push constant x` as `@x / D=A / …`, which is a one-to-one translation only
while `x` is non-negative. SM is in precisely the same position: its
`push_const` emits `@` followed by the literal.

**What this costs either way.** Allowing `<- -5` would mean emitting
`@5 / D=A / D=-D` instead of `@5 / D=A`, which saves two instructions over
writing `<- 5` then `(-)` — and costs every student a sign test inside the
command they implement first. Negative constants are rare; the branch is in
every translator forever.

*Proposed, reversing what this entry said before:* follow the course. `<- 5`
takes a non-negative decimal; a negative value is `<- 5` followed by `(-)`.
A leading sign is a syntax error rather than silently falling through to the
next template and becoming a push of a global named `-5`.

*Separately, and regardless:* the bare `<-` must be an error. It matches
`<-([0-9]*)` with an empty capture today and emits a bare `@`. The bare `->`
has the same defect, noted under Q4.

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
