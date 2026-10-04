# BasicLoop

A label, an unconditional jump and a conditional one, inside a function.

`BasicLoop.sum` adds 1 to 6 and returns 21.

## What to do

Translate the `.sm` files here into `BasicLoop.asm`, leave it in this directory,
and run `BasicLoop.tst` in the course's CPU emulator. Run `BasicLoopSM.tst` in the SM
emulator to watch the same program first; both check the same `BasicLoop.cmp`.

**No bootstrap yet.** Your translator does not emit one until the last test of
this package, so the script plants the frame a caller would have left: the
arguments, the caller's frame pointer, a return address, and `SP`. The
function's code is first in the translation, so it runs straight away, and
`LCL` is worked out from `SP` by the declaration itself.

The return address points outside the program on purpose. When the function
returns there, the run simply stops — which is what the course does too, its
own script planting an address of 1000 and letting the CPU wander through
unassembled ROM until the ticks run out.
