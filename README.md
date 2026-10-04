# SM — a stack machine as an alternative to the nand2tetris VM

This repository hosts an online replacement for the virtual-machine part of the
*nand2tetris* course (projects 7–8, and the code-generation half of 11).

The alternative machine is called **SM**. It keeps what is good about the course
VM — a stack as the universal computation device, a tiny textual instruction set,
a translator the student writes by hand — and removes what the authors of SM
found arbitrary in it: eight memory segments, numeric addresses, a split between
`LCL` and `ARG`, and a boolean convention that forces comparisons through
conditional jumps.

Planned deliverables (nothing is implemented yet):

1. an **SM emulator** that runs in the browser;
2. **translators** SM → VM and VM → SM;
3. a **Jack → SM compiler**;
4. a **reference page** for SM and a **rationale page** explaining the design;
5. **`projects/07-sm/`** and **`projects/08-sm/`** — packages parallel to units
   7 and 8 of the course: tests, each with SM source, a `.tst` script that runs
   it in the SM emulator, and a `.tst`/`.cmp` pair that checks the `.asm` the
   student is asked to produce by writing their own SM → Hack-assembly
   translator.

The student writes two programs and nothing else: that translator, and then a
Jack → SM compiler in place of the course's project 11. The second assignment
needs no package of ours — the course's project 11 holds only `.jack` files and
Jack is unchanged here — so the student uses the course's own directory and
runs the result in our emulator, which carries the library.

Everything else is scaffolding. The SM ↔ VM translators are never assigned —
they are there so a program can cross between the SM track and the course's own
track.

Start here:

* [`PLAN.md`](PLAN.md) — the work plan.
* [`spec/INVENTORY.md`](spec/INVENTORY.md) — what the supplied material contains,
  and the list of specification questions it leaves open.
* [`spec/CORRECTIONS.md`](spec/CORRECTIONS.md) — the points where we deliberately
  depart from that material. The reference directory is never edited; this file
  records the changes instead, and the implementation follows it.
* [`reference/`](reference/) — the original material, kept verbatim.

SM was designed by Avraham Aizenbud and Meir Aizenbud. The course VM is from
N. Nisan and S. Schocken, *The Elements of Computing Systems*, MIT Press 2005.
