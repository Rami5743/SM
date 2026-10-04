# The working copy of the supplied implementations

[`../reference/`](../reference/) is frozen: it is the record of what was handed
over, and it is never edited. This directory holds the same programs,
**repaired**, and it is what our ports are compared against.

Every repair is a commit of its own, saying what the defect was and why the
new behaviour is right. The set of those commits is a second record alongside
[`../spec/CORRECTIONS.md`](../spec/CORRECTIONS.md): that file says where we
depart from the supplied *documentation*, this history says where we depart
from the supplied *code*.

| here | was |
|---|---|
| `sm_translator.py` | `reference/implementation/SM_trnsleitor3.py` |
| `jack_compiler.py` | `reference/jack/jack_compaler.py` |
| `tokenizer.py` | `reference/jack/tokenazr.py` |
| `xml_parser.py` | `reference/jack/parser.py` |

The names are spelled out, which is the one change made without a defect
behind it.

Run them with `python3 oracle/run.py` — see `--help`.
