# Corrections

Deliberate deviations from the material in [`../reference/`](../reference/).

That directory is a historical record and is never edited. This file is the
normative list of the points where the system we are building differs from it.
Each entry says what the reference does, what we do instead, and what has to
change. Anything not listed here follows the reference.

Decisions on the open questions of [`INVENTORY.md`](INVENTORY.md) §3 land here
as they are taken.

---

## C1 — `->[]`: the prose is corrected, the code is kept

*Settles Q1. A documentation change; no behaviour changes.*

**The reference.** The prose of `SM_doc_details.txt`, of the LaTeX document and
of `SM_doc_implimintation.txt` says that the top of the stack is the address and
the element below it the value. The hand-written assembly, the translator, the
annotated `fib.sm` and the Jack compiler all do the opposite.

**We do.** What the code does. The top of the stack is the **value**, the
element below it the **address**.

> **`[]` — peek.** The top of the stack is an address. The command replaces it
> by the content of that register.
>
> `… addr` → `… RAM[addr]`
>
> **`->[]` — poke.** The top of the stack is a value and the element below it is
> an address. The command removes both and stores the value in that register.
>
> `… addr value` → `…`, with `RAM[addr] := value`

The reasoning is recorded under Q1 in `INVENTORY.md`. It yields a rule the
reference page should state once rather than per command: **in every two-operand
command the deeper operand is the left-hand one** — `x` in `x-y`, `x<y`, `x>y`,
and the address in `RAM[addr] := value`.

**Touches.** The reference page only.

---

## C2 — the stack starts at 256

*A behaviour change.*

**The reference.** The bootstrap is `@256 / D=A / @SP / M=D`, and `SP` holds the
address of the top element rather than of the first free cell, so the first
value pushed lands at `RAM[257]` and cell 256 is never used.

**We do.** The bootstrap sets `SP = 255`. An empty stack is `SP = 255`, and the
first value pushed lands at `RAM[256]`.

This is a one-constant change. The convention that `SP` addresses the top
element is unaffected, and so is everything built on it — the frame layout, the
call sequence, the return sequence, every command. The stack simply begins where
the Hack memory map says it begins.

`RAM[255]` is never read or written: a push increments before it writes, so the
first write is to 256, and a pop from an empty stack is a program error. So
`SP = 255` is a sentinel value and not a cell the machine uses, and it cannot
collide with a global that the Hack assembler happens to place there.

*Considered and not taken:* making `SP` address the first free cell, as the
course's VM does, which would also put the first element at 256. It is the
larger change — every push, every pop, and the frame arithmetic — and it would
contradict every supplied artefact, for a gain that is cosmetic given that we
generate the `.cmp` files ourselves.

**Touches.** The bootstrap sequence; the emulator's initial state; every `.cmp`
file, whose `RAM[0]` is one lower than the reference would give; the statement
of the memory map in the reference page.

---

## C3 — `==` is the equality mnemonic, and `=` is an error

*Settles Q2. A documentation change, plus a diagnostic the reference lacks.*

**The reference.** `SM_doc_details.txt` writes the equality command `=`. The
LaTeX document, `all_cmds.sm` and `SM_trnsleitor3.py` all write `==`.

**We do.** `==`. The single `=` is not a synonym and not an alias; it is a
syntax error.

Rejecting it explicitly matters more than it looks, because of how the
reference parser is built. Its last template is a catch-all: any line it does
not otherwise recognise is a **call** to a function of that name. So `=` today
is not an error at all — it compiles to a jump to `FUNTION.=`, a symbol no
function ever defines, which the Hack assembler then allocates as an ordinary
variable. The program jumps to a garbage address. Silently.

That is a property of the catch-all rule rather than of this command, and it
turns every typo in the language into the same failure. So this entry carries a
second requirement with it:

> Every called name must resolve to a declared function. A call to an
> undeclared name is a diagnostic.

With that in place, `=` produces "unknown function `=`" and, better, so does
every other mistyped command. Without it, nothing in this language can be
mistyped safely.

**Whose job this is.** Ours — the emulator, `sm-core`, and the tools we write
with them. The student's translator is not required to validate its input, any
more than the course requires it of theirs, and nothing in `projects/07-sm`
tests for it. The point of the check is that a student can tell a malformed
`.sm` file from a bug in the translator they are in the middle of writing.

**Touches.** The reference page; the parser's catch-all rule; the whole-program
check that resolves call targets, in our tools only.

---

## C4 — the mnemonics are the language; the words are a view

*Settles Q6. No change to the language; an addition to the emulator.*

**The reference.** `<-`, `->`, `-->`, `?-->`, `!`, `<--`, and the trailing colon
of a label. The design letter is unsure whether these are an improvement or a
gimmick, and floats keeping symbols for the arithmetic and logical operations
only.

**We do.** The mnemonics stay, and they are the language — the only accepted
input syntax. Alongside them the emulator offers a word-for-word **rendering**
of any program, so the two can be compared by looking at them rather than by
arguing about them.

**One invariant the rendering must respect:** the arithmetic and logical
operators are symbolic in every view and are never spelled as words. `+`, `-`,
`(-)`, `&`, `|`, `~`, `==`, `>`, `<`, `[]` and `->[]` stay exactly as they are.
Only the structural commands have a word form — push, pop, goto, if-goto,
function, return, label. This is the split the letter itself suggests, and it is
the one that survives the argument: nobody wants to read `add` where `+` will
do, and the case for `<-` over `push` is the one genuinely in doubt.

**A view, not a second syntax.** The words are produced by a pretty-printer over
the AST and are not accepted as input. Two ways to write every command would be
a real cost in a teaching language, and nothing is gained: a rendering is
enough to decide the question by eye.

**Touches.** One pretty-printer over the AST; one toggle in the emulator. The
exact word for each mnemonic is settled in M0 with the rest of the reference.

---

## C5 — constants are non-negative, and an empty operand is an error

*Settles Q8. A narrowing of what the parser accepts; no change to any program
that was already well formed.*

**The reference.** The pattern for a constant is `<-([0-9]*)`. It accepts no
sign, so `<- -5` falls through to the next template and becomes a push of a
global named `-5`. It also accepts the empty string, so a bare `<-` is read as
a constant push and emits a bare `@`. The pattern for pop-to-global, `->(.*)`,
accepts an empty name in the same way.

**We do.** Follow the course.

> `<- n` takes a decimal constant in `0..32767`. A negative value is written
> `<- n` followed by `(-)`. A leading sign is a syntax error.
>
> A bare `<-` and a bare `->` are syntax errors.

**Why non-negative.** The course forbids negative literals at all three of its
levels and SM is in the same position for the same reason. `push constant x`
takes "some non-negative integer x", and negative numbers come from `neg`. A
Jack `integerConstant` is a decimal in `0..32767`, and `-5` is the unary
operator applied to the literal `5` — which the prototype's Jack compiler
already handles by emitting `(-)`. Underneath both: the Hack A-instruction has
fifteen bits and no sign, so `@-5` cannot be assembled, and a constant push is
a one-to-one translation only while the constant is non-negative.

Allowing `<- -5` would save two instructions per negative constant, by emitting
`@5 / D=A / D=-D` instead of `@5 / D=A / (-)`. It would cost every student a
sign test inside the first command they implement, in every translator, forever.
Negative constants are rare.

**Why the empty operand is an error rather than a fallthrough.** For the reason
given in C3: this language's parser ends in a catch-all, so anything not
rejected becomes a call to a function that does not exist, and thence a jump to
a garbage address. `<- -5` silently becoming a push of a global named `-5` is
the same failure wearing a different hat.

**Touches.** The reference page; the two patterns; the diagnostics in our tools
(not in the student's translator — see C3).

---

## C6 — the two missing-return checks, exactly as the course has them

*Settles the companion to Q3. The supplied prototype has neither check; the
official tools have both, and we copy both rather than invent anything.*

**The reference.** `jack_compaler.py` emits nothing when a Jack subroutine ends
without a `return`, and `SM_trnsleitor3.py` emits nothing at the end of an SM
function. Control then runs into the next function's declaration, which sets
`LCL` from the current `SP` and pushes that function's locals, so it executes
with a frame holding no return address and its own `<--` jumps to a garbage
address.

**We do** what the official tools do, which is to catch it twice.

### 1. In the Jack compiler, statically

Reject the file, as the official compiler does:

```
In Main.jack (line 4): In subroutine noReturn:
    Program flow may reach end of subroutine without 'return'
```

No output is produced for the file at all — one bad subroutine fails the
compilation. The rule, recovered by running the official compiler on eleven
purpose-built subroutines, is a structural recursion. Define *completes(S)* as
"control can reach the point just after S":

| statement | completes? |
|---|---|
| `let`, `do` | yes |
| `return` | no |
| `if (c) {A} else {B}` | iff A completes or B completes |
| `if (c) {A}`, no else | **always** |
| `while (c) {A}` | **iff A completes** |
| a list | iff every statement in it completes |

A subroutine is accepted iff its body does not complete. A statement following
one that does not complete is unreachable, and draws
`Warning: Unreachable code` without failing the compilation.

Two of those rows are worth staring at, because they are where the analysis
knowingly parts company with the truth. The `if`-without-else row is
*conservative*: the condition might be false, so the end is reachable. The
`while` row is *optimistic*: a loop is treated as exiting only by completing
its body, although it may run zero times. That is why
`while (true) { return 1; }` is accepted — convenient, and the shape of many
real main loops — and also why `while (false) { return 1; }` is accepted,
which is simply wrong and will fall off the end.

### 2. In the SM emulator, at run time

Stepping from a function's last command into another function's declaration is
a fault, stopping the program as the VM emulator stops it:

```
Missing return in Foo.a
```

This check is dynamic in the course and dynamic here. Measured: the same `.vm`
file loads and runs without complaint when the offending function is never
called.

**Why both, rather than either.** The static check has a line number and fires
before anything runs, which is what a student needs; but its `while` rule is
unsound, so programs that fall through do get past it. The runtime check has no
line number and only fires on the path actually taken; but nothing gets past
it. Each covers the other's gap, which is presumably why the course has both.

**Not adopted:** a *static* version of the SM-level check. The course has no
such thing, and the instruction here is to match it. Q9, which would have
supplied it, is declined, so this is settled rather than pending.

**Touches.** `jack-to-sm`, which gains the analysis above; `sm-emulator`, which
gains the runtime fault; the reference page, which states both.

---

## C7 — function names are distinct, and the course's name checks are adopted

*Settles the first part of Q5. A rule added to the language definition, plus
the diagnostics the course already performs.*

**The reference.** The document states that the local names of a function must
be distinct, and that the labels of a function must be distinct. It says
nothing about function names. Nothing enforces any of the three.

**We do.** Add the missing rule to the language definition:

> **Function names are global to the program and must be distinct.** Two
> declarations of the same name, whether in one file or across files, are an
> error.

The reason is in the language rather than in the translation: a call is the
bare name, so two functions sharing one make every call to it ambiguous in the
source. Measured, for completeness: the `FUNTION.` prefix is a constant,
identical for every function, so two files declaring `!f()` emit `(FUNTION.f)`
twice; the Hack assembler accepts that silently and resolves every call to the
second definition.

**While stating that rule, state the whole picture**, since it is short and the
reference currently leaves it to be inferred. SM has four kinds of name, and
they do not collide with one another:

| kind | scope | how it is written at the point of use |
|---|---|---|
| local (argument or internal) | one function | `<- @x`, `-> @x` |
| global | the program | `<- x`, `-> x` |
| label | one function | `L:`, `--> L`, `?--> L` |
| function | the program | `f` |

A global and a function may share a name; so may a label and either. Only
within a kind must names be distinct — and for a local or a label that means
within its function, while for a global or a function it means across the
program.

**The checks, which are the course's own.** Measured on the course's VM
emulator, all three at load time, each detected inside a function the program
never calls:

| mistake | message, in the course's wording |
|---|---|
| call to an undeclared function | `Nope.vm not found or function Nope.missing not found in Nope.vm` |
| jump to an undeclared label | `Unknown label - Sys.init$NoSuchLabel` |
| two functions with the same name | `A.vm: subroutine f already exists` |

And two more. The first the course does not check, the rule being the author's
own and already in the document. The second it does check, but only at run
time:

| mistake | message | note |
|---|---|---|
| the same label twice in one function | `A.sm: in line 4: label L already exists in function f` | the course does not check it |
| `<- @x` or `-> @x` where `x` is not a local of the enclosing function | `A.sm: in line 7: f has no local named x` | the course catches the analogue at run time: `Out of segment space in Foo.f.1` |

The second is worth a sentence, because it is a place where SM is *better
placed* than the course rather than stricter than it. The course's locals are
numeric offsets, so `push local 5` in a function with two locals cannot be
judged until the offset is computed — a runtime fault. SM's locals are names
resolved against the declaration, so the same mistake is a name that does not
exist, caught by the same pass as the other four and reported with a line
number before anything runs. Nothing is being tightened; the design simply
allows the check to happen earlier.

Adopted with file and line numbers, as the course gives them. This also
supplies what C3 asked for from the other side: with call targets resolved, a
mistyped command stops being a jump to a garbage address.

**Whose job.** Ours. These live in the emulator and `sm-core`; the student's
translator is never required to perform them, and no test in either package
expects a diagnostic from it.

**Touches.** The reference page; `sm-core`'s resolution pass; the emulator's
loader.
