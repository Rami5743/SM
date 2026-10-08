# The SM language

The normative reference. Where this document and anything else disagree, this
document wins — including [`INVENTORY.md`](INVENTORY.md), which describes the
*supplied* implementation, and the material in [`../reference/`](../reference/),
which is a historical record and is not maintained.

Every point at which this reference departs from that material is recorded, with
its reasoning, in [`CORRECTIONS.md`](CORRECTIONS.md) as **C1**–**C9**. Those
marks appear below where they apply.

SM is a stack machine. It is an alternative to the virtual machine of
N. Nisan and S. Schocken, *The Elements of Computing Systems* (MIT Press, 2005),
and it targets the same Hack computer.

---

## 1. Lexical structure

### 1.1 Symbols

A **symbol** begins with a letter or `_` and continues with letters, digits,
`_` and `.` (C8). Nothing else is a symbol.

A symbol may not begin with a digit.

The `.` carries no meaning to the machine. It is a character like any other,
and a name that contains one is an ordinary name.

A command word is read as a command only as the first word of a line, so a
variable, a label or a function may be named `add` or `goto`; such a name is
only ever used in an operand.

### 1.2 Lines

A program is a sequence of lines. Each line holds at most one command.

A command is a word, sometimes followed by one operand, separated by spaces or
tabs. **Every command is written in lower case.** Space at either end of the
line is ignored, so

```
if-goto loop
    if-goto loop
```

are the same command.

The declaration is the one command with punctuation of its own, and space
inside it is ignored, so

```
function f(a, b) locals t, u
function f (a,b) locals t,u
```

are the same declaration.

A `//` begins a comment, which runs to the end of the line. The comment is
removed before the line is read.

A line that is empty once the comment is removed is not a command, and is
skipped.

### 1.3 Integers

An integer constant is a decimal number in `0..32767`. **A leading sign is a
syntax error** (C5).

---

## 2. The memory model

### 2.1 The Hack address space

| region | addresses |
|---|---|
| registers | `0..15` |
| global variables | `16..255` |
| stack | `256..2047` |
| heap | `2048..16383` |
| screen | `16384..24575` |
| keyboard | `24576` |

SM programs reach the heap, the screen and the keyboard through
`push-indirect` and `pop-indirect`.

**All of RAM is zero at reset.** This matches the course's CPU emulator.

### 2.2 The stack pointer

The stack pointer is kept in register 0 and is called `SP`.

`SP` holds the address of the **first free cell** — not of the top element.
This is what it means in the course's VM as well (C2).

A push onto the stack writes where `SP` points and then increments it; a pop
off the stack decrements and then reads.

The bootstrap sets

```
SP = 256
```

so an **empty stack is 256**, and the first value pushed lands there.

The stack ends at 2047. A push with no free cell left is an overflow into the
heap.

### 2.3 Variables

A variable occupies one register. There are two kinds.

**Local variables** belong to one function. They are its arguments and its
internal variables, all declared with it, and they vanish when it returns. They
cannot be reached from outside it. They are reached through `@`: `push @x`.

**Global variables** belong to the program. Any function may read or write any
of them. They are reached without `@`: `push x`.

**Globals are translated into ordinary assembly variables**, and the
assembler places them in memory by its own algorithm. Past 240 of them they
spill into the stack.

---

## 3. Functions

### 3.1 What a function is

Every function takes some number of arguments from the top of the stack,
removes them, and pushes exactly one result. It may also have side effects
elsewhere in RAM.

This holds for most of the built-in commands too. For instance `add` takes two
and pushes one.

### 3.2 Declaring one

A function declares its arguments and its internal variables together, at its
head:

```
function f(a, b) locals t, u
```

declares `f` with arguments `a` and `b` and internal variables `t` and `u`.
Either list may be empty, and `locals` is written only when there are some.

### 3.3 Calling and returning

A call is `call` and the function's name. The arguments must already be on the
stack, the first one deepest.

`return` returns. The value to return must be on top of the stack. Everything
belonging to the frame — the arguments, the internal variables, and anything
left above them — is removed, and the returned value takes the place of the
first argument.

### 3.4 The frame

The frame is the place in memory that holds a function's arguments and
internal variables. It begins at the address called `LCL`, which is kept in
register 1.

Within a function of `a` arguments and `l` internal variables, with `LCL` the
frame pointer:

| | address |
|---|---|
| argument `i` | `LCL + i` |
| the caller's `LCL` | `LCL + a` |
| the return address | `LCL + a + 1` |
| internal variable `j` | `LCL + a + 2 + j` |

A call pushes the caller's `LCL` and then the return address. The
declaration sets the frame pointer and pushes `l` zeros; the return restores
it:

```
LCL = SP - (a+2)
SP  = LCL
LCL = RAM[LCL + a]
```

The return also saves the top of the stack, pushes it back after the
restore, and jumps to the return address.

There is a single frame pointer, `LCL`. Arguments and internal variables are
at known offsets from it.

### 3.5 Labels

Labels are there to be jumped to. A label is recognised only inside the
function that declares it, and two functions may use the same label name.

---

## 4. Names

SM has four kinds of name, and they do not collide with one another (C7):

| kind | scope | how it is written where it is used |
|---|---|---|
| local — argument or internal | one function | `push @x`, `pop @x` |
| global | the program | `push x`, `pop x` |
| label | one function | `label L`, `goto L`, `if-goto L` |
| function | the program | `call f` |

Names of different kinds may share a name, and so may the names of variables
and of labels in different functions.

Within one kind, and within the scope that kind has, names must be distinct.

---

## 5. Booleans

Every register has a truth value, and **only the most significant bit carries
that meaning.** A register is true if that bit is set and false if it is
clear; the remaining fifteen bits do not bear on its truth value.

---

## 6. The commands

A command that has a counterpart among the course's VM commands is spelled the
way the course spells it (C9).

In the tables below, three dots mean "and so on". The names `x`, `f`, `loop` stand for any symbol,
and `5` for any integer constant.

### 6.1 Stack

| command | effect |
|---|---|
| `push 5` | push the constant `5` onto the stack |
| `push x` | push the global variable `x` onto the stack |
| `push @x` | push the local variable `x` onto the stack |
| `pop x` | pop off the stack into the global variable `x` |
| `pop @x` | pop off the stack into the local variable `x` |

`push` and `pop` each take exactly one operand, and `pop` takes a variable
rather than a constant.

### 6.2 Arithmetic and logic

Each takes its operands from the top of the stack and replaces them with its
result. **In every two-operand command the deeper operand is the left-hand
one** — `x` in each of these:

```
x - y
x < y
x > y
```

| command | stack before → after | meaning |
|---|---|---|
| `add` | `… x y` → `… x+y` | sum |
| `sub` | `… x y` → `… x-y` | difference |
| `neg` | `… x` → `… -x` | arithmetic negation |
| `not` | `… x` → `… !x` | bitwise negation (and so logical not) |
| `and` | `… x y` → `… x&y` | bitwise and (and so logical and) |
| `or` | `… x y` → `… x\|y` | bitwise or (and so logical or) |
| `eq` | `… x y` → `… b` | `b` is true exactly when `x = y` |
| `gt` | `… x y` → `… b` | `b` is true exactly when `x > y` |
| `lt` | `… x y` → `… b` | `b` is true exactly when `x < y` |

The three comparisons leave a value whose truth is read at the most
significant bit alone, as section 5 has it, and nowhere else: `lt` leaves
`x - y` and `gt` leaves `y - x`, so the remaining bits are whatever the
subtraction left there.

### 6.3 Memory

| command | stack before → after | effect |
|---|---|---|
| `push-indirect` | `… addr` → `… RAM[addr]` | read the register |
| `pop-indirect` | `… addr value` → `…` | `RAM[addr] := value` |

**The address is the deeper operand and the value is on top** (C1) — the same
rule as every other two-operand command, the address being the left-hand side
of an assignment.

Both take their address from the stack rather than from the command, so
`push-indirect` leaves the stack exactly as deep as it found it and
`pop-indirect` removes two cells.

These two take the place of the course's `pointer`, `this` and `that`
segments. A pointer is an ordinary value on the stack.

### 6.4 Control

| command | effect |
|---|---|
| `call f` | call the function `f` |
| `label loop` | declare the label `loop` |
| `goto loop` | jump to `loop` |
| `if-goto loop` | pop; jump to `loop` if the value is true |
| `function f(x1, x2, ...) locals y1, y2, ...` | declare `f` |
| `return` | return |

---

## 7. Errors

The emulator and the tools on this site diagnose everything below. **A
student's translator is never required to**, exactly as the course never
requires it of theirs: the programs it is given are well formed by
construction, and a translator may assume so.

### 7.1 Before the program runs

| | |
|---|---|
| a call to a function that is not declared | C3, C7 |
| a jump to a label the function does not declare | C7 |
| two functions with the same name | C7 |
| the same label twice in one function | C7 |
| `push @x` or `pop @x` where the function has no local `x` | C7 |
| a line that is no command, or a command given the wrong number of operands | C3 |
| a leading sign on a constant | C5 |

The last of the name checks is one SM can make earlier than the course can.
Its locals are numbered, so an out-of-range one is a runtime fault; ours are
named, so it is simply a name that does not exist.

### 7.2 While the program runs

| | |
|---|---|
| a push with no free cell left | the stack has overflowed into the heap |
| control reaching the end of a function without `return` | C6 |

Both stop the program and name the function. Both are what the course's VM
emulator does.

---

## 8. Programs

### 8.1 Files

A program is one or more files. Each consists of whole functions: a file
begins with a declaration, and every command belongs to some function.

*One exception, for teaching only.* The first package of exercises uses files
that are a bare sequence of commands with no declaration at all, so that the
stack and the operators can be met before frames are. The emulator accepts
such a **fragment** and runs it with the stack as its only state. The course
takes the same liberty in its project 7. From the second package onward, only
whole programs.

### 8.2 Starting and stopping

Execution begins with the bootstrap:

```
SP = 256
call Sys.init
```

The call to `Sys.init` is an ordinary **call**.

`Sys.init` takes no arguments. When it returns, the program enters an infinite
loop; the bootstrap is where that return lands.

Only functions reachable from `Sys.init` ever run.

---

## 9. SM and the course's VM, side by side

A program can cross between the two machines, and `@sm/vm` translates it in
either direction. What follows is where the two differ, which is where a
translation has something to do. Nothing here is part of SM.

Many commands are spelled the same way in both. Where a row below gives the
same word on both sides, the word is shared and the behaviour is not.

| | SM | the course's VM |
|---|---|---|
| the stack pointer | the same in both: `SP` names the first free cell, and an empty stack based at 256 is `SP = 256` | |
| the frame | one pointer: arguments, the saved `LCL`, the return address, internal variables | five: the return address and the saved `LCL`, `ARG`, `THIS`, `THAT` |
| where the arity is written | at the declaration, `function f(a, b)` | at the call, `call f 2` |
| a local | named, `push @count` | numbered, `push local 3` |
| indirection | `push-indirect` and `pop-indirect` over an address on the stack | `pointer`, `this`, `that`, re-pointed before each use |
| a boolean | the most significant bit, and nothing else | all ones for true, zero for false |
| `lt` | the whole value is `x - y` | the whole value is all-ones or zero |
| `if-goto` | branches when the most significant bit is set | branches when the value is not zero |
| shared storage | globals, named, reachable from anywhere | `static i`, per file, reachable only within it |
