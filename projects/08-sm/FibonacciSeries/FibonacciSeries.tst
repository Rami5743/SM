// FibonacciSeries: run the assembly your translator produced.

load FibonacciSeries.asm,
output-file FibonacciSeries.out,
compare-to FibonacciSeries.cmp,
output-list RAM[0]%D1.6.1 RAM[310]%D1.6.1 RAM[3000]%D1.6.1 RAM[3001]%D1.6.1 RAM[3002]%D1.6.1 RAM[3003]%D1.6.1 RAM[3004]%D1.6.1 RAM[3005]%D1.6.1;

// The bootstrap is the last thing you will write, so this script plants the
// frame a caller would have left and the function's code, being first in the
// translation, simply runs. Four lines where the course's needs twelve: an SM
// frame saves one pointer and a return address, and LCL is derived from SP.
set RAM[310] 3000,    // the argument at
set RAM[311] 6,       // the argument n
set RAM[312] 0,       // the caller's frame pointer
set RAM[313] 9999,    // a return address outside the program
set RAM[0] 314,       // SP, from which the declaration derives LCL

repeat 10000 {
  ticktock;
}

output;
