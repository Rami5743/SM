// StaticsTest: run the assembly your translator produced.
//
// This is the test the bootstrap is for. Your translator must now emit code
// that sets SP and calls Sys.init, so the script sets nothing.

load StaticsTest.asm,
output-file StaticsTest.out,
compare-to StaticsTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1;

repeat 200000 {
  ticktock;
}

output;
