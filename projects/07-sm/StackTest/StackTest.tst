// StackTest: run the assembly your translator produced.
//
// Translate StackTest.sm into StackTest.asm, put it in this directory, and run
// this script in the course's CPU emulator. It checks the same StackTest.cmp
// that StackTestSM.tst checks over the source.

load StackTest.asm,
output-file StackTest.out,
compare-to StackTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1 RAM[257]%D1.6.1 RAM[258]%D1.6.1 RAM[259]%D1.6.1 RAM[260]%D1.6.1 RAM[261]%D1.6.1 RAM[262]%D1.6.1 RAM[263]%D1.6.1 RAM[264]%D1.6.1 RAM[265]%D1.6.1 RAM[266]%D1.6.1 RAM[267]%D1.6.1;

// Part I's translation carries no bootstrap -- the student has not met one
// yet -- so the script sets the stack pointer, as every project-7 script of
// the course does. An empty stack is 255, so the first value pushed is at 256.
set RAM[0] 255,

repeat 2000 {
  ticktock;
}

output;
