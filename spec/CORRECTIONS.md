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
