# Reference material, verbatim

The material supplied by the authors of SM, copied unchanged except for being
sorted into directories. Nothing here is built or tested; it is the record of
what SM was before this repository existed, and the authority behind
[`../spec/INVENTORY.md`](../spec/INVENTORY.md).

* `doc/` — the language reference, in LaTeX and in plain text, plus the
  `VM1_*` drafts that preceded SM and used numeric addresses.
* `implementation/` — the SM to Hack-assembly translator in Python, and the
  hand-written assembly fragment for each command that it was derived from.
  `SM_trnsleitor3.py` imports a module `asembly_OO` that was not supplied, so
  it does not run as it stands.
* `jack/` — the Jack to SM compiler in Python.
* `samples/` — example programs. `FibonacciElement_sm` additionally carries
  `.tst` and `.cmp` files taken from the course; they describe the course VM,
  not SM, and do not run (see `spec/INVENTORY.md` section 4).
* `tst/all_cmds.sm` — one occurrence of every SM command, useful as a parser
  test.
