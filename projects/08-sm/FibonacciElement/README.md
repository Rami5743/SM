# FibonacciElement

Several files, recursion, `Sys.init`, and the bootstrap your translator now emits.

`Sys.init` returns the sixth Fibonacci number, 8.

## What to do

Translate every `.sm` file in this directory into a single `FibonacciElement.asm`, leave
it here, and run `FibonacciElement.tst` in the course's CPU emulator.

**The bootstrap.** This is the test it exists for. Your translator must now
emit, before anything else, code that sets `SP` to 256 and calls `Sys.init`,
followed by an infinite loop for `Sys.init` to return into. Nothing in the
script sets up for you.

An empty stack is `SP = 256`, so the value `Sys.init` returns lands at
`RAM[256]`.
