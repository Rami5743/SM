#!/usr/bin/env python3
"""
Run the repaired reference implementations.

  run.py sm <folder> [--no-bootstrap]
                         translate every .sm in the folder to <folder>.asm
  run.py jack <folder>   compile every .jack in the folder to .sm beside it

These are the programs our ports are measured against. See README.md for why
there are two copies of them.
"""
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def main(argv):
    if len(argv) < 3 or argv[1] not in ('sm', 'jack'):
        print(__doc__.strip())
        return 2
    what, folder = argv[1], argv[2]
    bootstrap = '--no-bootstrap' not in argv
    if what == 'sm':
        import sm_translator
        sm_translator.translate_fold(folder, bootstrap=bootstrap)
        print(folder + '.asm')
    else:
        import jack_compiler
        jack_compiler.compale_folder(folder)
        print(folder)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
