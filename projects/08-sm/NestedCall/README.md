# NestedCall

A frame has to survive a call. Three functions deep, each checking its own internal variables afterwards.

`NestedCall.outer` returns 120 for n = 5: the innermost doubles it, and each frame adds its own two values back.

## What to do

Translate the `.sm` files here into `NestedCall.asm`, leave it in this directory,
and run `NestedCall.tst` in the course's CPU emulator. Run `NestedCallSM.tst` in the SM
emulator to watch the same program first; both check the same `NestedCall.cmp`.

**No bootstrap yet.** Your translator does not emit one until the last test of
this package, so the script plants the frame a caller would have left: the
arguments, the caller's frame pointer, a return address, and `SP`. The
function's code is first in the translation, so it runs straight away, and
`LCL` is worked out from `SP` by the declaration itself.

The return address points outside the program on purpose. When the function
returns there, the run simply stops — which is what the course does too, its
own script planting an address of 1000 and letting the CPU wander through
unassembled ROM until the ticks run out.
