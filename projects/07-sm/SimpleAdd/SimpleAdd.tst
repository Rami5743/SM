// SimpleAdd: run the assembly your translator produced.
//
// Translate SimpleAdd.sm into SimpleAdd.asm, put it in this directory, and run
// this script in the course's CPU emulator. It checks the same SimpleAdd.cmp
// that SimpleAddSM.tst checks over the source.

load SimpleAdd.asm,
output-file SimpleAdd.out,
compare-to SimpleAdd.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 255, so the first value pushed is at 256.
set RAM[0] 255,

repeat 2000 {
  ticktock;
}

output;
