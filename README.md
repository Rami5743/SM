# SM — a stack machine as an alternative to the nand2tetris VM

This repository hosts an online replacement for the virtual-machine part of the
*nand2tetris* course (projects 7–8, and the code-generation half of 11).

The alternative machine is called **SM**. It keeps what is good about the course
VM — a stack as the universal computation device, a tiny textual instruction set,
a translator the student writes by hand — and removes what the authors of SM
found arbitrary in it: eight memory segments, numeric addresses, a split between
`LCL` and `ARG`, and a boolean convention that forces comparisons through
conditional jumps.

What is here:

1. an **SM emulator** that runs in the browser, with the stack, the frames,
   the globals, the screen and the keyboard — `packages/sm-emulator`;
2. a **`.tst` runner**, the course's own test-script language, driving it
   both in the browser and from the command line — `packages/sm-tst`;
3. a **reference SM → Hack assembly translator**, which is the first thing a
   student is asked to write — `packages/sm-to-asm`;
4. a **Jack → SM compiler**, with the course's own two checks, and the
   **standard library** written in Jack, compiled by it, and carried by the
   emulator — `packages/jack-to-sm` and `os/`;
5. **translators both ways between SM and the course's VM** —
   `packages/sm-vm`;
6. **`projects/07-sm/`** and **`projects/08-sm/`** — packages parallel to
   units 7 and 8 of the course: eleven tests, each with SM source, a `.tst`
   script that runs it in the SM emulator, and a `.tst`/`.cmp` pair that
   checks the `.asm` the student is asked to produce;
7. a **bilingual site** — Hebrew and English — carrying the emulator, the
   compiler, the bridge, the reference and the rationale.

The student writes two programs and nothing else: that translator, and then a
Jack → SM compiler in place of the course's project 11. The second assignment
needs no package of ours — the course's project 11 holds only `.jack` files and
Jack is unchanged here — so the student uses the course's own directory and
runs the result in our emulator, which carries the library.

Everything else is scaffolding. The SM ↔ VM translators are never assigned —
they are there so a program can cross between the SM track and the course's own
track.

## How it is checked

Nothing here is believed because it looks right. Where the course has an
answer, that answer is the test:

* the parser is compared against the course's own project 10 XML, all seven
  class files, token stream and parse tree, and passes its `TextComparer`;
* the Jack compiler's output runs the course's project 11 programs, Pong
  included, and its project 12 tests — three of them against the course's
  own `.cmp` files, and the rest by reading the screen back as text and
  comparing with what its reference images show;
* every `.vm` program of the course's projects 7 and 8 is translated to SM
  and run against the course's own `.cmp`;
* SM translated to VM is run on the course's own VM emulator and compared
  with what our emulator makes of the SM it came from;
* each of the eleven student tests is satisfied twice over, once by the SM
  and once by the assembly, and a deliberately broken translator fails.

`npm test` runs all of it, and continuous integration runs `npm test`.

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
