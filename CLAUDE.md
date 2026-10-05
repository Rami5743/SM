# Working on this repository

## Reader-facing text carries no trace of how it was made

Two kinds of text live here and they must not mix.

**Internal.** `PLAN.md`, `spec/INVENTORY.md`, `spec/CORRECTIONS.md`,
`oracle/`, code comments, commit messages. These are where the reasoning
goes: what was measured, what was decided and why, what the supplied
prototype got wrong, what we chose not to do. Write them fully.

**Reader-facing.** `spec/sm.md`, `spec/sm.he.md`, `spec/RATIONALE.md`, every
string and page in `web/`, every `README.md` under `projects/`. A student
reads these. They have never seen our discussion and have no question it
could answer.

The test, before any sentence reaches a reader-facing file: **does the
reader have the question this sentence answers?** If the sentence exists
because *we* once asked something, it belongs in the internal half.

What this rules out, with real examples from this repository:

* *Answering a question only we asked.* "We do not host them, only link"
  answers "should we host the course's tools?". The reader sees links and
  wonders nothing.
* *Reporting our process.* "measured rather than assumed", "this follows the
  supplied implementation and is kept deliberately", "it was recovered by
  running the official compiler on eleven subroutines". The reader needs the
  fact, not its provenance.
* *Saying where something else is.* "the argument is kept in the git
  history", "see the commit that made this change". Reader-facing text does
  not point at our workings.
* *"We" and "our" as a party distinct from the reader.* Name the thing
  instead: "the emulator", "the tools on this site".
* *Explaining an editorial choice.* "this is here because this is the page a
  reader compares the two on". Either the content belongs on the page or it
  does not.

Honesty about a limitation is not process talk and stays: "a translated
program that manages the heap itself must be given a heap that ends below
its globals" is something the reader needs.

## The rest

* Work on `main`.
* `reference/` is frozen. Deliberate departures go in `spec/CORRECTIONS.md`;
  repairs to the supplied code go in `oracle/`.
* Validating input is our tools' job, never the student's.
* Every milestone ships its own automated tests, plus the cumulative suite.
  `npm test` runs everything.
* In Hebrew text, do not invent Hebrew for a technical term; if in doubt,
  leave it. Keep code, mnemonics, file names and diagnostics in backticks so
  they run left to right inside a Hebrew line.
* **Never take `unicode-bidi: isolate` off the code selectors in
  `web/src/style.css`.** `direction` alone does nothing to an inline box.
  Without the isolation, a token made only of neutral characters inherits
  the paragraph's embedding, and in a Hebrew paragraph `[]` paints as `][`,
  `->[]` as `][>-`, `<--` as `--<`, `(-)` as `)-(` and `0..32767` as
  `32767..0`. `site.test.ts` measures every character's box on every page
  and fails if a left-to-right run is painted out of order; one of its cases
  removes the property and asserts that the page then fails.
