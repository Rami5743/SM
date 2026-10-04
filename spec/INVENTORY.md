# Inventory of the supplied material, and the open specification questions

This file records what was handed over, what the three existing implementations
actually do, and every point on which they disagree with each other or with the
prose documentation. The items marked **Q** were the decisions M0 of
[`../PLAN.md`](../PLAN.md) had to take; **all of them are now taken**, and the
ones that changed something are recorded in
[`CORRECTIONS.md`](CORRECTIONS.md), C1 to C7.

## 1. What was supplied

Kept verbatim under [`../reference/`](../reference/).

| Area | Files | State |
|---|---|---|
| Language reference | `SM_doc_details_tex.tex` / `.pdf`, `SM_doc_details.txt` | Prose spec; the two differ slightly |
| Implementation notes | `SM_doc_implimintation.txt` | Hand-written Hack-assembly fragment per SM command |
| SM → Hack assembly | `SM_trnsleitor3.py` (+ `2`, and two backups) | Translates correctly, but will not import: it needs an `asembly_OO` module that was **not** supplied, used only by a step that runs after translation |
| Jack → SM | `jack_compaler.py`, `parser.py`, `tokenazr.py` | Covers the full Jack grammar; emits SM |
| Earlier design drafts | `VM1_doc.txt`, `VM1_par_doc.txt`, `VM1_no_par_doc.txt`, `VM1_par_doc_re.txt`, `VM1_doc_details.txt` | Numeric-address predecessors of SM; historical |
| Sample programs | `FibonacciElement_sm/`, `FibonacciSeries_sm/`, `fibonachie/`, `tst/test1/all_cmds.sm` | See §4 |

**The one thing the material does not contain is an SM emulator.** The missing
`asembly_OO` is not a second gap: it is imported at module level, which is why
the translator will not run, but it is used only by `add_numbrs`, a step that
executes *after* translation is complete and only annotates each SM line with
the Hack instruction number it produced. The repair is to make that step
optional. We write no Hack assembler — the course's is used where one is
needed (`../PLAN.md` §3).

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
site; see M9 in `../PLAN.md`.

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

Decided so far: **Q1** (→ C1), **Q2** (→ C3), **Q6** (→ C4), **Q8** (→ C5), the companion to
Q3 (→ C6), **Q5** (→ C7), and **Q3**, **Q4**, **Q7** and **Q9**, all closed by
keeping things as they are.

**Nothing in this section is open.** Each decision that changed something is an
entry in [`CORRECTIONS.md`](CORRECTIONS.md), C1 to C7, which is the normative
list of our deviations from `reference/`. The questions are kept here with
their reasoning so that a settled one is not reopened from memory.

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

**One consequence to settle with it, and the course settles it.** The
bootstrap pushes `LCL` before anything has set it, so the value landing in
`RAM[256]` is whatever that register holds at reset. Left undefined, the cell
is non-deterministic and any `.cmp` covering it is unreliable.

The course is in the same position — its own bootstrap is `call Sys.init 0`,
which pushes `LCL`, `ARG`, `THIS` and `THAT` before any of them is set — and
it resolves the matter in the tool rather than in the specification. Measured:
the supplied CPU emulator reports every one of `RAM[0..4]` and `RAM[256]` as
`0` before a program has run. All of RAM is zero at reset.

*Decided with Q3:* the same, and the simpler rule rather than the narrower one
— **all of RAM is zero at reset**, not merely the registers. The bootstrap then
sets `SP`; `LCL`, `ARG`, `THIS` and `THAT` are never touched by SM and stay
zero. `packages/hack/` inherits the behaviour from the tool it reimplements, so
the two agree by construction.

Worth noting even so: the course's own `FibonacciElement.cmp` checks `RAM[0]`
and `RAM[261]` and nothing in between, so it never depends on the frame cells.
Ours should be written with the same restraint, whatever the reset rule
guarantees.

**The companion question, raised with this one and settled separately:** what
happens when a function reaches its last line without a `<--`. The reference
translator emits nothing, so execution runs straight into the next function's
declaration, which sets `LCL` from the current `SP` and pushes that function's
locals — entering it with a frame that has no return address, so its own `<--`
jumps to a garbage address.

Both supplied `Sys.init` files are one step from this. The hand-written one has
a `<--`, but only after an infinite loop, so it is unreachable; the
Jack-generated one has no `<--` at all, because Jack's `Sys.init` body is
`while (true) {}` with no `return`, and is saved only by that loop.

**DECIDED → C6: exactly what the course does, which is to catch it twice** —
statically in the Jack compiler, which rejects the file, and dynamically in the
emulator, which stops the program with `Missing return in Foo.a`. Both were
measured on the official tools, and C6 records the static rule in full,
including the two rows where it knowingly parts company with the truth.

A *static* version of the SM-level check is not adopted, the course having no
counterpart. Q9 would supply it free if taken.

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

**Q5 — name resolution: what the course checks, and the two rows beyond it.**

*Two corrections to how this entry used to read.* It claimed a function and a
global may not share a name — wrong; they are written differently at the point
of use, `<- foo` against `foo`, and reach the assembler as `SM.foo` and
`FUNTION.foo`. And it justified requiring unique function names by saying they
"become a single flat space of `FUNTION.` labels", which is the consequence and
not the reason. The reason is that **the language offers no other way to name a
function**: a call is the bare name, so two functions sharing one make every
call to it ambiguous in the source, however it is translated.

**Measured, since the prefixes were raised as possibly sufficient.** They are
not: `FUNTION.` is a constant, identical for every function. Translating two
files that each declare `!f()` emits

```
(FUNTION.f)
(FUNTION.f)
```

and the Hack assembler accepts that silently — assembled, it resolves every
`@FUNTION.f` to the **second** definition. The prefixes separate functions from
variables and labels, which is what §2 says they do; they do not separate
functions from each other.

**What the course's VM emulator does, measured on purpose-built inputs.** Every
check below is at load time: each was detected inside a function the program
never calls, and no output was produced.

| mistake | the course | SM today |
|---|---|---|
| call to an undefined function | `Sys.vm: in line 2: Nope.vm not found or function Nope.missing not found in Nope.vm` | silent; `@FUNTION.f` becomes a variable, jump to a garbage address |
| jump to an undefined label | `Sys.vm: in line 2: Unknown label - Sys.init$NoSuchLabel` | silent, the same way |
| two functions with the same name | `A.vm: subroutine f already exists` | silent; the assembler keeps the last |
| the same label twice in one function | **nothing** | silent |
| argument count disagreeing with the declaration | nothing at load; may surface later as `Stack overflow in Sys.init.3` | silent |

So three of the five rows are *exactly what the course does*, with file and line
numbers, and adopting them is copying the book.

**The fourth row** — a label declared twice in one function — the course lets
through. The documentation already forbids it in prose, so this is a question
of whether to enforce a rule the author wrote but the book does not check.

**The fifth row is not a name question at all, and belongs to Q9.** The course
can compare a count because `call f n` carries one at the call site. SM carries
none — the arity is the callee's alone, which is the property that lets the
student's translator work in one pass — so there is nothing to compare. The
depth walk of Q9 is what would catch it: too few arguments drives the depth
negative, too many leave it high at the `<--` or at a label merge.

**Whose job, as always.** Ours. These are input-validation checks and they live
in the emulator and `sm-core`; the student's translator is never required to
perform any of them, and no test in either package expects a diagnostic from
it. See the principle in `../PLAN.md` §2.

**DECIDED → C7.** Function names must be distinct, and that rule goes into the
language definition. The three checks the course performs are adopted with its
messages and line numbers, and so is a fourth it does not perform — a label
declared twice in one function, the rule being the author's own and already in
the document. The fifth row is not a name question and died with Q9: nothing
checks an argument count, which is also what the course does.

**Q6 — the mnemonics. DECIDED → C4: the mnemonics are the language; the words
are a view.** The emulator renders any program word-for-word so the two can be
compared by eye, but only the structural commands have a word form — the
arithmetic and logical operators stay symbolic everywhere.

**Q7 — statics versus globals. CLOSED: not an SM question.** No entry in
`CORRECTIONS.md`.

**SM has one kind of global variable and no convention about naming it.** The
separation between a static and a global is a *Jack* notion — `static` against
`field`, class-level against per-object — and Jack has no globals outside
classes at all. Compiling a Jack class does produce SM globals named
`Class.name`, so SM code that came from Jack satisfies the convention; but that
is a property of the compiler's output, not a rule the language imposes on
anybody else. A hand-written SM program may name its globals as it likes, and
the `.` is simply a character that a symbol may contain.

This entry previously treated the convention as an SM-level rule awaiting a
decision about enforcement. There is nothing to enforce.

**It also claimed the convention was load-bearing for the SM → VM bridge. That
is wrong too**, and the correction belongs here because it changes how M9 is
written. The reasoning was that the course's VM has a per-file `static`
segment, so something must say which globals belong to which file. But the
course's VM has no shared-global storage of any kind — `static i` in one file
is a different cell from `static i` in another — so mapping SM globals onto
`static` cannot work regardless of what they are called.

The translation that does work needs no convention at all: give each SM global
a fixed address and reach it through `pointer`/`that`, which is uniform for
dotted and undotted names alike. It is also the honest translation, since the
course's own statics live at `RAM[16..255]` and an SM global is exactly a cell
at a fixed address.

**What the reference page should say:** globals are one flat space of named
cells. The dotted naming appears once, in the Jack chapter, as what the
compiler emits for a class's statics.

**Q8 — negative literals. DECIDED → C5: follow the course.** `<- n` takes a
non-negative decimal; a negative value is `<- n` then `(-)`; a leading sign is
a syntax error, and so are a bare `<-` and a bare `->`. The course forbids
negative literals at all three of its levels, and the cause is the same one
that binds SM: the Hack A-instruction has fifteen bits and no sign, so a
constant push is a one-to-one translation only while the constant is
non-negative.

**Q9 — should the stack depth be a function of the program point? DECLINED.**
No entry in `CORRECTIONS.md`; nothing changes.

The proposal was to require that at every point inside a function the depth of
the stack above the locals be determined by the point rather than by the path,
and to reject programs that break it. It would have caught, statically, a
compiler whose statement calls leave a value behind — and it did catch the real
defect in the supplied Jack compiler (§4a).

**It is declined because it is not SM's business.** A program that grows the
stack in a loop is a legitimate SM program, as it is a legitimate VM program.
Narrowing the language to make a class of compiler bug unrepresentable puts the
cost on every SM program to catch a mistake that belongs to one compiler.

**What the course does instead, measured.** It lets such a program run and
stops it when the stack actually overflows, naming the function:

```
Stack overflow in Sys.init.1
```

That is the model: the program is legal, the emulator bounds the stack at run
time, and the fault is reported where it happens. Our emulator does the same
and nothing more.

**What falls away with it.**

* The *static* version of the missing-return check at the SM level. Only the
  two course checks of C6 remain — static in the Jack compiler, dynamic in the
  emulator.
* The last row of Q5, an argument count disagreeing with the declaration.
  Nothing checks it, which is also what the course does: measured, it reports
  nothing at load time and the mistake surfaces later, if at all, as the same
  stack overflow.

**What survives, as a tool rather than a rule.** The depth walk is still the
cheapest way to check *our own* compiler's output, so it stays in M7's test
suite as a lint run in continuous integration over the SM we generate. It
rejects nothing that anyone else writes, and the emulator does not know it
exists.

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

## 4a. Defects in the supplied Jack compiler

Found by running the official `JackCompiler` and the prototype side by side on
the prototype's own sample. Recorded because M7 inherits this code as a
reference.

**It emits an argument that does not exist.** `copiele_sub_call` writes
`<-@this` before every unqualified call, which is right for a method and wrong
inside a `function`, and the prototype does not distinguish the two. Compiling
`reference/samples/fibonachie/` today gives:

```
!Main.fibonachie(n)          ← one argument
...
<-@this                      ← pushed anyway
<-@n
<-1
-
Main.fibonachie
```

Two arguments are pushed to a one-argument function, and `@this` is not among
its locals at all. The official compiler diagnoses the Jack source for the same
reason — *"Subroutine Main.fibonachie called as a method from within a
function"* — so the source is also at fault; the prototype simply does not
notice.

**Both proposed checks catch it, which is the best evidence either of them
has.** Q5's name resolution: `@this` is not a declared local of
`Main.fibonachie`. Q9's depth walk: the body reaches `<--` at depth 2, where
exactly 1 is required. Neither was devised with this in mind.

**A checked-in sample no longer matches the compiler that made it, and the
sample is the better of the two.** Re-running the supplied compiler on the
supplied `.jack` and diffing against the supplied `.sm`:

```
Sys.sm   identical apart from line endings
Main.sm  two added lines, both <-@this, in Main.fibonachie
```

So the drift is exactly the defect above, and the checked-in file predates it.
`Main.fibonachie` is declared with one argument and the checked-in output
pushes one value per call; today's compiler pushes two. The output did not
rot — the code did, and the stale file preserves the earlier, working
behaviour.

The likely history, inferred rather than known: `<-@this` was added so that
methods would receive their receiver, and applied to every unqualified call
without the accompanying check that the enclosing subroutine is in fact a
method. That made the compiler more faithful to Jack's rule — an unqualified
call *is* a method call — and broken at the same time, since a `function` has
no `this` to pass. The official compiler resolves the same tension by
rejecting the source.

**What this costs a reader.** Those four files sit in one directory with
matching names and read as a specification of what the compiler emits. They
are not one. The defect above was found only by running the compiler; reading
the sample suggests the opposite, that no `<-@this` is emitted.

**And what it costs us:** nothing now, because our own `.sm` goldens are
generated by the build and compared on every run rather than hand-maintained
(`../PLAN.md` §4). Had this file been such a golden, the regression would have
been caught by the commit that introduced it.

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
