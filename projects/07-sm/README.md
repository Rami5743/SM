# Part I — the commands that need no frame

The first half of the SM translator. Write a program that reads a `.sm` file
and writes the Hack assembly it means.

This part covers constants, globals, the arithmetic and logical commands, and
the two memory commands. No functions, no frames, no bootstrap — those are
[part II](../08-sm/).

| Test | What it adds |
|---|---|
| [`SimpleAdd`](SimpleAdd/) | the stack, and one operator |
| [`StackTest`](StackTest/) | every arithmetic and logical command, and the truth convention |
| [`GlobalTest`](GlobalTest/) | global variables |
| [`PointerTest`](PointerTest/) | `push-indirect` and `pop-indirect` |
| [`StaticTest`](StaticTest/) | dotted names, which are ordinary globals |

Do them in that order; each assumes the ones before it.

## How a test works

Each directory holds the SM source, two scripts, and one comparison file.

* `<Name>SM.tst` runs the **source** in the SM emulator. Start here: it shows
  you what the program is supposed to do before you have translated anything.
* `<Name>.tst` runs the **assembly you produce**, in the course's CPU
  emulator. Put your `<Name>.asm` in the directory and run it.
* `<Name>.cmp` is what both must produce. It was generated from the source, not
  written by hand.

## Two things the scripts do for you

**They set the stack pointer.** Your translator does not emit a bootstrap yet,
so each script sets `RAM[0]` itself. `SP` names the first free cell, as it
does in the course, so an empty stack is 256 and the first value pushed lands
there.

**They name only the stack.** A comparison file cannot name a global's cell:
where your translator puts a global is your own business, and two correct
translators will not agree. Every test therefore leaves its results on the
stack, which is also why some of them write a global and then read it back.

## What you may assume

That the input is a well-formed SM program. Checking it is not part of the
assignment, exactly as it is not part of the course's. If you want to know
whether a file is well formed, load it into the SM emulator, which says so.
