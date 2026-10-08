# Part II — control flow, functions, and the bootstrap

The second half of the translator. Everything in
[part I](../07-sm/) still has to work; this part adds labels and jumps, the
function declaration, the call, the return, and finally the bootstrap.

| Test | What it adds |
|---|---|
| [`BasicLoop`](BasicLoop/) | `label`, `goto`, `if-goto` |
| [`FibonacciSeries`](FibonacciSeries/) | the same, over an array in the heap |
| [`SimpleFunction`](SimpleFunction/) | a declaration, internal variables, `return` |
| [`NestedCall`](NestedCall/) | frames that must survive a call |
| [`StaticsTest`](StaticsTest/) | several files sharing globals, with `Sys.init` |
| [`FibonacciElement`](FibonacciElement/) | recursion, several files, and the bootstrap |

In that order. The first four come before you have written the bootstrap; the
last two are what it is for.

## Why locals are here and not in part I

In the course, `push local 0` belongs to project 7, because a local there is a
number counted from a pointer the test script sets by hand. In SM a local is a
*name*, and the name means nothing without the declaration that lists it. So
locals arrive with the function that owns them.

## How a function is tested before the bootstrap exists

The first four scripts plant the frame a caller would have left:

```
set RAM[310] 6,       // the argument
set RAM[311] 0,       // the caller's frame pointer
set RAM[312] 9999,    // a return address outside the program
set RAM[0] 313,       // SP, from which the declaration derives LCL
```

Four lines. The course's equivalent needs twelve, because its frame saves four
pointers where SM's saves one, and because its script must set `LCL` and `ARG`
where SM's declaration works `LCL` out from `SP` itself.

The function's code is first in your translation, so it runs straight away.
When it returns to that address outside the program, the run stops — the same
trick the course uses, its own script planting 1000 and letting the CPU wander
through unassembled ROM until the ticks run out.

## The bootstrap

`StaticsTest` and `FibonacciElement` have a `Sys.init`, and their scripts plant
nothing. By then your translator must emit, before anything else:

* `SP = 256`;
* a call to `Sys.init`, built the same way as any other call;
* an infinite loop, which is where `Sys.init` returns to.

It is an ordinary call, with no exception to it. The value `Sys.init` returns
lands at `RAM[256]`.
