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
5. **`projects/07-sm/`** — a package parallel to unit 7 of the course: a set of
   tests, each with SM source, a `.tst` script that runs it in the SM emulator,
   and a `.tst`/`.cmp` pair that checks the `.asm` the student is asked to
   produce by writing their own SM → Hack-assembly translator;
6. **`projects/11-sm/`** — the same for the second assignment, in which the
   student writes their own Jack → SM compiler.

The student writes those two programs and nothing else; everything above them is
scaffolding. The SM ↔ VM translators are never assigned — they are there so a
program can cross between the SM track and the course's own track.

Start here:

* [`PLAN.md`](PLAN.md) — the work plan.
* [`spec/INVENTORY.md`](spec/INVENTORY.md) — what the supplied material contains,
  and the list of specification questions it leaves open.
* [`reference/`](reference/) — the original material, kept verbatim.

SM was designed by Avraham Aizenbud and Meir Aizenbud. The course VM is from
N. Nisan and S. Schocken, *The Elements of Computing Systems*, MIT Press 2005.
