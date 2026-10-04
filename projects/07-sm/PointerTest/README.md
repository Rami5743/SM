# PointerTest

`[]` and `->[]`, with the address the deeper operand and the value on top.

## What to do

Translate `PointerTest.sm` into `PointerTest.asm` with your translator, leave it in this
directory, and run `PointerTest.tst` in the course's CPU emulator.

To see what the program is supposed to do before translating it, run
`PointerTestSM.tst` in the SM emulator. Both scripts check the same `PointerTest.cmp`.

## What the script does for you

Your translator does not yet emit a bootstrap — that comes at the end of part
II — so the script sets the stack pointer itself. An empty stack is `SP = 255`,
so the first value pushed lands at `RAM[256]`.

The comparison names the stack and nothing else. It cannot name a global's
cell: where your translator puts a global is your own business, and two
correct translators will not agree.
