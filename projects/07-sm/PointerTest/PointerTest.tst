// PointerTest: run the assembly your translator produced.
//
// Translate PointerTest.sm into PointerTest.asm, put it in this directory, and run
// this script in the course's CPU emulator. It checks the same PointerTest.cmp
// that PointerTestSM.tst checks over the source.

load PointerTest.asm,
output-file PointerTest.out,
compare-to PointerTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1 RAM[257]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 256, where the first value pushed lands.
set RAM[0] 256,

repeat 2000 {
  ticktock;
}

output;
