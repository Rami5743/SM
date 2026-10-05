// BasicLoop: run the SM source in the SM emulator.

load,
output-file BasicLoop.out,
compare-to BasicLoop.cmp,
output-list RAM[0]%D1.6.1 RAM[310]%D1.6.1;

// The bootstrap is the last thing you will write, so this script plants the
// frame a caller would have left and the function's code, being first in the
// translation, simply runs. Four lines where the course's needs twelve: an SM
// frame saves one pointer and a return address, and LCL is derived from SP.
set RAM[310] 6,       // the argument n
set RAM[311] 0,       // the caller's frame pointer
set RAM[312] 9999,    // a return address outside the program
set RAM[0] 313,       // SP, from which the declaration derives LCL

repeat 10000 {
  smstep;
}

output;
