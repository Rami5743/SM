# Why SM is not the course's VM

[`sm.md`](sm.md) states the language. This states the case for it. The
arguments are Avraham and Meir Aizenbud's, from the letter that began the
project; what is added here is the evidence from building the thing, including
the places where a cost turned out to be real.

The course's virtual machine is from N. Nisan and S. Schocken, *The Elements of
Computing Systems* (MIT Press, 2005). SM is an alternative to it, not a
criticism of the book.

---

## A virtual machine should not be shaped by one language's implementation

A virtual machine is meant to be generic — independent of the platform below it
and, ideally, of the high-level language above it. In practice few languages
ever share one, but the aim still disciplines the design.

The course's VM has eight memory segments. Several of them exist because Jack
needs them: `this` and `that` and `pointer` are there to implement Jack's
objects and arrays. A student meets them before meeting the reason, and some of
them look arbitrary until chapter 11 explains them.

There is a teaching cost beyond the puzzlement. Segments that behave *almost*
alike invite almost-alike code: either the same translation written several
times with small differences, or a design general enough to cover them all,
planned in advance. Both are hard, in a project that is hard already.

SM has two kinds of variable, local and global, and no segments.

## The stack should carry all of the computation

The best thing about the course's VM is the stack. Coming to it from assembly,
where memory is addressed directly, routing every computation through a stack
can look like a step backwards: to add two numbers you must first move them
somewhere. The point only becomes clear when you see Jack compiled. Then every
operand is already in place, because the thing that produced it put it there.
Moving happens at the edges — at the start and the end — and that is cheap.

But the course's VM stops short. Pointers are not handled on the stack; they
are handled by setting `pointer 0` or `pointer 1` and then reaching through
`this` or `that`. So a computation that involves a pointer leaves the stack and
comes back.

SM finishes the idea. Two commands do it:

```
[]      the value on top is an address; replace it with what is there
->[]    the value on top is a value and the one below it an address; store it
```

Both are ordinary stack operations: operands from the top, result to the top,
side effects where the program asks for them. With those, the `pointer`, `this`
and `that` segments are not needed, and an array access is an expression like
any other.

**Where this pays, concretely.** In the course's VM, compiling `a[i] = b[j]`
means stashing something in `temp` because `that` can only point at one array
at a time. In SM both addresses are just values:

```
<- @a      <- @i      +        address of a[i]
<- @b      <- @j      +   []   value of b[j]
->[]
```

Left to right, no temporary, and the same shape as every other expression.

**Where it costs.** For an object's fields the course keeps `this` fixed for a
whole method, so a field access is one segment reference. SM re-derives the
object's address each time. That is slower, and the honest statement is that it
is slower. Two things soften it: a call is cheaper here, since there is no
`this` or `that` to save and restore, so code in the style the course
encourages — many small accessors — comes out close to even; and this is a
teaching machine, where a uniform treatment of pointers is worth more than the
cycles.

## Variables should have names

Assembly already has symbolic variables. Moving to numeric offsets feels like
going backwards, and nothing forces it: the VM language is textual, so its
variables may as well be named too.

Named locals turn out to buy something concrete. An out-of-range local is a
runtime fault in the course's emulator — `Out of segment space in Foo.f.1` —
because `local 5` is only wrong once you compute the offset. In SM it is a name
that does not exist, caught before the program runs and reported with a line
number.

## One frame pointer is enough

The course keeps `LCL` and `ARG`. But the distance between them is fixed once
the function's arguments are known, which is at translation time, so the second
pointer stores something already known.

SM keeps `LCL` alone. Because the variables are named, the arithmetic is
invisible to the programmer; the only thing asked of them is not to give an
argument and an internal variable the same name, which a high-level programmer
would not do anyway.

The change has a second effect worth more than the register. The arguments are
declared with the function instead of counted at the call site, so **a call
names the function and nothing else** — and the argument count is needed only
by the callee. A translator from SM to assembly therefore needs no function
table and no second pass, which is what makes the first assignment tractable.

The contrast is sharp: a translator from SM *to the course's VM* does need both,
because the VM writes the count at the call.

## Statics and globals need not be two mechanisms

The course separates `static` from `temp`. SM has one flat space of globals, and
a program that wants the distinction gets it by naming — a Jack compiler emits
`Class.name` for a class's statics. That is a property of the compiler's output,
not a rule of the machine.

## Booleans should not need a branch

The course's convention is that true is all ones and false all zeros. Every bit
matters, so a comparison cannot be computed directly: `x > y` has to be turned
into a conditional jump that produces one canonical value or the other.

If only the most significant bit carries meaning, the comparison *is* the
arithmetic. `x < y` is the sign of `x - y`. No label, no jump, no branch.

The cost is a real one and belongs here: the two conventions disagree. A
translator between SM and the course's VM has to normalise at the boundary, and
the conditional jump is where it shows — `if-goto` branches on "non-zero" where
`?-->` branches on "negative", and those are not the same test.

## The bootstrap is a call

An early version of this argument said that calling `Sys.init` wastes a frame:
nothing is running yet, so there is no environment to save.

It is true of half the frame. The saved `LCL` is meaningless. The return
address is not — the specification promises that when `Sys.init` finishes the
program enters an infinite loop, and the return address is where that lands.
Dropping it would mean rewriting that promise.

So the bootstrap performs an ordinary call, and the student implementing it has
no exception to learn. Two cells and ten instructions, once.

## The mnemonics

`<-` for push, `-->` for goto, `!` for a declaration, `<--` for return.

The honest position is that this one is unsettled. It began as a convenience —
one of the authors is dyslexic, and the other was young enough that English was
an obstacle — and symbols may suit some readers and not others.

So it is not argued here; it is shown. The emulator renders any program both
ways, with the structural commands as words, and a reader can decide by looking.

One part is not in doubt. The arithmetic and logical operators stay symbolic in
every rendering. Nobody wants to read `add` where `+` will do, and the case for
`<-` over `push` is the only part genuinely in question.
