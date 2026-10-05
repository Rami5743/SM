// PointerTest: run the SM source in the SM emulator.
//
// This script and PointerTest.tst check the same PointerTest.cmp -- one over the
// source, one over the assembly you produce from it. That they agree is the
// whole premise of the exercise.

load,
output-file PointerTest.out,
compare-to PointerTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1 RAM[257]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 256, where the first value pushed lands.
set RAM[0] 256,

repeat 2000 {
  smstep;
}

output;
