# StackTest

Every arithmetic and logical command, and the most-significant-bit convention for truth.

## What to do

Translate `StackTest.sm` into `StackTest.asm` with your translator, leave it in this
directory, and run `StackTest.tst` in the course's CPU emulator.

To see what the program is supposed to do before translating it, run
`StackTestSM.tst` in the SM emulator. Both scripts check the same `StackTest.cmp`.

## What the script does for you

Your translator does not yet emit a bootstrap — that comes at the end of part
II — so the script sets the stack pointer itself. `SP` names the first free
cell, so an empty stack is `SP = 256` and the first value pushed lands
there.

The comparison names the stack and nothing else. It cannot name a global's
cell: where your translator puts a global is your own business, and two
correct translators will not agree.
