// SimpleAdd: run the SM source in the SM emulator.
//
// This script and SimpleAdd.tst check the same SimpleAdd.cmp -- one over the
// source, one over the assembly you produce from it. That they agree is the
// whole premise of the exercise.

load,
output-file SimpleAdd.out,
compare-to SimpleAdd.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 255, so the first value pushed is at 256.
set RAM[0] 255,

repeat 2000 {
  smstep;
}

output;
