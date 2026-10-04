// StaticsTest: run the SM source in the SM emulator.
//
// Nothing is planted here. The program has a Sys.init, so it starts the way a
// finished program starts: the bootstrap sets SP and calls it.

load,
output-file StaticsTest.out,
compare-to StaticsTest.cmp,
output-list RAM[0]%D1.6.1 RAM[256]%D1.6.1;

repeat 100000 {
  smstep;
}

output;
