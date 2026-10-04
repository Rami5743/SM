# FibonacciSeries

The same control flow, writing an array in the heap.

`FibonacciSeries.fill` writes the first six Fibonacci numbers from 3000 and returns that address.

## What to do

Translate the `.sm` files here into `FibonacciSeries.asm`, leave it in this directory,
and run `FibonacciSeries.tst` in the course's CPU emulator. Run `FibonacciSeriesSM.tst` in the SM
emulator to watch the same program first; both check the same `FibonacciSeries.cmp`.

**No bootstrap yet.** Your translator does not emit one until the last test of
this package, so the script plants the frame a caller would have left: the
arguments, the caller's frame pointer, a return address, and `SP`. The
function's code is first in the translation, so it runs straight away, and
`LCL` is worked out from `SP` by the declaration itself.

The return address points outside the program on purpose. When the function
returns there, the run simply stops — which is what the course does too, its
own script planting an address of 1000 and letting the CPU wander through
unassembled ROM until the ticks run out.
