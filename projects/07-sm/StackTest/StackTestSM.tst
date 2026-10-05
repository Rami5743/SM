// StackTest: run the SM source in the SM emulator.
//
// This script and StackTest.tst check the same StackTest.cmp -- one over the
// source, one over the assembly you produce from it. That they agree is the
// whole premise of the exercise.

load,
output-file StackTest.out,
compare-to StackTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1 RAM[257]%D1.6.1 RAM[258]%D1.6.1 RAM[259]%D1.6.1 RAM[260]%D1.6.1 RAM[261]%D1.6.1 RAM[262]%D1.6.1 RAM[263]%D1.6.1 RAM[264]%D1.6.1 RAM[265]%D1.6.1 RAM[266]%D1.6.1 RAM[267]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 256, where the first value pushed lands.
set RAM[0] 256,

repeat 2000 {
  smstep;
}

output;
