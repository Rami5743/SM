# Inventory of the supplied material, and the open specification questions

This file records what was handed over, what the three existing implementations
actually do, and every point on which they disagree with each other or with the
prose documentation. Every item marked **Q** is a decision that has to be taken
before M1 of [`../PLAN.md`](../PLAN.md); the "proposed" line is a
recommendation, not a decision.

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
semantics. This is the behaviour the new emulator has to reproduce, because the
`.cmp` files of the student package must match what the student's own translator
produces.

**Stack pointer.** `SP` holds the address of the **top element**, not of the
first free cell. Push is `@SP / AM=M+1 / M=D` — increment, then write. The
bootstrap sets `SP = 256`, so an empty stack is `SP = 256` and the first element
pushed lands at `RAM[257]`; cell 256 is never used. This differs from the course
VM, where `SP = 256` means the first element is at `RAM[256]`, and it changes
every expected `RAM[0]` value.

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

**Bootstrap.** `SP = 256`, then a *call* to `Sys.init`, then an infinite loop.

**Reserved assembly symbols** the runtime occupies: `SP`, `LCL`, `tmp`, `end`,
and the prefixes `SM.`, `FUNTION.`, `LABEL.`, `call.`.

## 3. Questions

Decided so far: **Q1**. The rest are open.

**Q1 — operand order of `->[]`. DECIDED: the code is right, the prose is wrong.**

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

**Q2 — equality mnemonic.** `=` in `SM_doc_details.txt`, `==` in the LaTeX
document, in `all_cmds.sm` and in the translator.
*Proposed:* `==`, and reject `=`.

**Q3 — `Sys.init`: called or jumped to?** The rationale letter argues for a
plain jump, there being no environment to save. The reference translator emits a
full call.
*Proposed:* jump. Then `<--` in `Sys.init` is a program error; the spec must say
so, and the emulator must report it rather than wander off.

**Q4 — discarding a return value.** Every SM function returns exactly one value,
so a statement call always leaves one behind. `jack_compaler.py` disposes of it
by popping into a global literally named `tmp`, which compiles to `SM.tmp` and
sits uncomfortably close to the runtime scratch register also named `tmp`.
*Proposed:* add an explicit discard command to the language rather than leave
every compiler to invent a convention; and rename the runtime scratch so no
user-visible name can collide with it.

**Q5 — name spaces.** A bare symbol on a line is a call, so a function and a
global variable may not share a name. Labels are distinguished by their colon.
*Proposed:* state the rule explicitly and have the emulator diagnose collisions.

**Q6 — the mnemonics.** The letter itself is unsure whether `<-`, `-->`, `!`,
`<--` are an improvement or a gimmick, and floats keeping symbols only for the
arithmetic and logical operations.
*Proposed:* keep the mnemonics as the language, and have the emulator offer a
word-for-word alternative rendering of any program (`push`, `goto`, `function`,
`return`), so the question can be settled by looking at both. This costs one
pretty-printer over the AST.

**Q7 — statics versus globals by naming convention.** A name containing `.` is
a static of the file named before the dot; a name without a dot is a true
global. This is a convention, not a rule the translator enforces.
*Proposed:* have the tools warn when a file writes to a dotted name belonging to
another file, and leave it legal.

**Q8 — negative literals.** The parser's pattern for `<- 5` is `[0-9]*`, which
accepts no sign and also matches a bare `<-`.
*Proposed:* `<- -5` is legal and the bare `<-` is an error.

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
